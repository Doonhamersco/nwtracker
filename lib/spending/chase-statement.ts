import { normaliseIsoDate } from "@/lib/spending/dates";
import { roundPence } from "@/lib/spending/money";
import type { ImportTransactionsInput } from "@/lib/validators/transactions";

const ACCOUNT_NAME = "Chase UK";

const PERIOD_RE =
  /(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\s+(?:to|[-–—])\s+(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/i;

const DATE_LINE_RE = /^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\b\s*(.*)$/;

const BALANCE_LABEL_RE =
  /^(opening balance|closing balance|balance brought forward|balance carried forward|brought forward|carried forward)\b[\s:,-]*/i;

/**
 * Optional sign, optional £ / GBP, thousands commas, two decimal places.
 * A fresh regex each call: a shared /g pattern keeps lastIndex between uses.
 */
function moneyPattern(): RegExp {
  return /([+-])?\s*(?:£|gbp\b)?\s*([+-])?\s*((?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})(?!\d)/gi;
}

const FX_RE = /\b[A-Z]{3}\s+[\d,]+\.\d{2}\s*@\s*\d/;

const SUMMARY_RE =
  /^(opening balance|closing balance|money in|money out|balance brought forward|balance carried forward|brought forward|carried forward|statement|account name|account number|sort code|available balance|date|description|amount|balance|transaction details|money in money out)$/i;

const TYPE_CANON: Record<string, string> = {
  purchase: "Purchase",
  payment: "Payment",
  transfer: "Transfer",
  "direct debit": "Direct Debit",
  "cash withdrawal": "Cash withdrawal",
  interest: "Interest",
  refund: "Refund",
  fee: "Fee",
  "standing order": "Standing order",
  "faster payment": "Faster Payment",
  "card payment": "Card payment",
  atm: "ATM",
};

export class ChaseStatementParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChaseStatementParseError";
  }
}

interface MoneyToken {
  sign: "+" | "-" | null;
  value: number;
}

export interface StatementRowWarning {
  date: string;
  description: string;
  message: string;
}

export type ParsedChaseStatement = ImportTransactionsInput & {
  warnings: StatementRowWarning[];
};

/**
 * Parse text extracted from a Chase UK statement PDF.
 * Each transaction is a dated line plus the type (and, for a foreign
 * purchase, an exchange-rate line) printed underneath. Amounts may be signed,
 * carry a £ or GBP prefix, include thousands commas, and sit on the date line
 * or a following line beside the running balance. Opening and closing balance
 * rows are not transactions. A row that still has no readable amount is listed
 * in `warnings` and does not abort the rest of the statement.
 */
export function parseChaseStatementText(text: string): ParsedChaseStatement {
  const lines = normaliseStatement(text)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    throw new ChaseStatementParseError("The PDF has no readable text.");
  }

  const periodEnd = statementPeriodEnd(lines.join("\n"));
  const openingFromSummary = labelledBalance(lines, /^opening balance\b/i);
  const closingFromSummary = labelledBalance(lines, /^closing balance\b/i);

  const transactions: ImportTransactionsInput["transactions"] = [];
  const warnings: StatementRowWarning[] = [];
  let previousBalance = openingFromSummary;
  let closingFromRows: number | undefined;

  for (const block of transactionBlocks(lines)) {
    const parsed = parseBlock(block, previousBalance);
    if (!parsed) continue;
    if (parsed.opening !== undefined) previousBalance = parsed.opening;
    if (parsed.closing !== undefined) closingFromRows = parsed.closing;
    if (parsed.warning) warnings.push(parsed.warning);
    if (!parsed.row) continue;
    transactions.push(parsed.row);
    previousBalance = parsed.row.balance_gbp;
  }

  if (transactions.length === 0) {
    throw new ChaseStatementParseError(
      "No Chase UK transactions were found in that PDF. Export the monthly statement from the Chase app and try again."
    );
  }

  const openingBalance = openingFromSummary ?? inferOpening(transactions[0]);
  const closingBalance =
    closingFromSummary ?? closingFromRows ?? transactions[transactions.length - 1]?.balance_gbp;

  const statementMonth =
    (periodEnd ? periodEnd.slice(0, 7) : null) ??
    transactions.reduce((latest, row) => (row.date > latest ? row.date : latest), transactions[0].date).slice(0, 7);

  return {
    account: ACCOUNT_NAME,
    statementMonth,
    ...(openingBalance !== undefined ? { openingBalance } : {}),
    ...(closingBalance !== undefined ? { closingBalance } : {}),
    transactions,
    warnings,
  };
}

function normaliseStatement(text: string): string {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/\u00a0/g, " ")
    .replace(/[\u00a3\u20a4]/g, "£")
    .replace(/[−–—]/g, "-")
    .replace(/\r\n?/g, "\n");
}

function statementPeriodEnd(text: string): string | null {
  const match = PERIOD_RE.exec(text);
  if (!match) return null;
  return normaliseIsoDate(`${match[4]} ${match[5]} ${match[6]}`);
}

function labelledBalance(lines: string[], label: RegExp): number | undefined {
  for (let i = 0; i < lines.length; i++) {
    if (!label.test(lines[i])) continue;
    const onLine = firstUnsigned(moneyTokens(lines[i]));
    if (onLine !== undefined) return onLine;
    const next = lines[i + 1];
    if (!next || DATE_LINE_RE.test(next)) continue;
    const fromNext = firstUnsigned(moneyTokens(next));
    if (fromNext !== undefined && stripMoney(next).length === 0) return fromNext;
  }
  return undefined;
}

function transactionBlocks(lines: string[]): string[][] {
  const blocks: string[][] = [];
  let current: string[] | null = null;
  for (const line of lines) {
    if (isTransactionStart(line)) {
      if (current) blocks.push(current);
      current = [line];
      continue;
    }
    if (current) current.push(line);
  }
  if (current) blocks.push(current);
  return blocks;
}

function isTransactionStart(line: string): boolean {
  if (!DATE_LINE_RE.test(line)) return false;
  if (PERIOD_RE.test(line)) return false;
  return true;
}

interface BlockOutcome {
  opening?: number;
  closing?: number;
  row?: ImportTransactionsInput["transactions"][number];
  warning?: StatementRowWarning;
}

function parseBlock(block: string[], previousBalance: number | undefined): BlockOutcome | null {
  const [first, ...rest] = block;
  const dateMatch = DATE_LINE_RE.exec(first);
  if (!dateMatch) return null;
  const iso = normaliseIsoDate(`${dateMatch[1]} ${dateMatch[2]} ${dateMatch[3]}`);
  if (!iso) return null;

  const content = [dateMatch[4] ?? "", ...rest].map((line) => line.trim()).filter((line) => line.length > 0);
  const sharedBalanceLine = peelBalanceLabel(content[0] ?? "") !== null && cleanDescription(peelBalanceLabel(content[0] ?? "")?.rest ?? "").length > 0;
  const { opening, closing, lines } = takeBalanceRows(content);
  if (lines.length === 0) {
    return opening === undefined && closing === undefined ? null : { opening, closing };
  }

  const tokens = lines.flatMap((line) => (FX_RE.test(line) ? [] : moneyTokens(line)));
  const description = descriptionFrom("", lines);
  if (!description) {
    return opening === undefined && closing === undefined ? null : { opening, closing };
  }

  // The balance label was peeled off a longer line, and nothing on the row was an amount.
  if (sharedBalanceLine && tokens.length === 0) {
    return { opening, closing, warning: rowWarning(iso, description) };
  }

  const typeLine = lines.map((line) => canonicalType(line)).find((type) => type !== null) ?? null;
  const signed = tokens.find((token) => token.sign !== null);
  const unsigned = tokens.filter((token) => token.sign === null);
  const balanceToken = unsigned.at(-1);

  let direction: "in" | "out";
  let amount: number;
  let balance: number;

  if (signed && balanceToken) {
    direction = signed.sign === "-" ? "out" : "in";
    amount = signed.value;
    balance = balanceToken.value;
  } else if (signed && previousBalance !== undefined) {
    direction = signed.sign === "-" ? "out" : "in";
    amount = signed.value;
    balance = roundPence(previousBalance + (direction === "out" ? -amount : amount));
  } else if (tokens.length >= 2 && balanceToken && previousBalance !== undefined) {
    amount = tokens[0].value;
    balance = balanceToken.value;
    direction = balance + 0.001 < previousBalance ? "out" : "in";
  } else if (tokens.length === 1 && previousBalance !== undefined) {
    balance = tokens[0].value;
    const delta = roundPence(balance - previousBalance);
    amount = Math.abs(delta);
    direction = delta < 0 ? "out" : "in";
    if (amount === 0) return { opening, closing };
  } else {
    return { opening, closing, warning: rowWarning(iso, description) };
  }

  if (!Number.isFinite(amount) || amount < 0) {
    return { opening, closing, warning: rowWarning(iso, description) };
  }

  const type = typeLine ?? defaultType(direction, description);
  return {
    opening,
    closing,
    row: {
      date: iso,
      description: description.slice(0, 2000),
      type,
      amount_gbp: roundPence(amount),
      direction,
      balance_gbp: roundPence(balance),
      ...(type === "Transfer" ? { is_transfer: true } : {}),
    },
  };
}

function rowWarning(date: string, description: string): StatementRowWarning {
  return {
    date,
    description,
    message: `Skipped "${description}" on ${date}: could not read the amount.`,
  };
}

function peelBalanceLabel(line: string): { kind: "opening" | "closing"; rest: string } | null {
  const match = BALANCE_LABEL_RE.exec(line.trim());
  if (!match) return null;
  const label = match[1].toLowerCase();
  const kind = label.includes("clos") || label.includes("carried") ? "closing" : "opening";
  return { kind, rest: line.trim().slice(match[0].length) };
}

/**
 * Drop leading opening/closing balance lines. A label that shares its line
 * with a payee ("Opening balance From EXAMPLE BROKER") stays, minus the label,
 * so the payment can still be read.
 */
function takeBalanceRows(lines: string[]): { opening?: number; closing?: number; lines: string[] } {
  const remaining = [...lines];
  let opening: number | undefined;
  let closing: number | undefined;

  while (remaining.length > 0) {
    const peeled = peelBalanceLabel(remaining[0]);
    if (!peeled) break;
    if (cleanDescription(peeled.rest)) {
      remaining[0] = peeled.rest;
      break;
    }
    let balance = moneyTokens(peeled.rest).at(-1)?.value;
    remaining.shift();
    if (balance === undefined && remaining[0] && isOnlyMoney(remaining[0])) {
      balance = moneyTokens(remaining[0]).at(-1)?.value;
      remaining.shift();
    }
    if (balance === undefined) continue;
    if (peeled.kind === "opening") opening = balance;
    else closing = balance;
  }

  return { opening, closing, lines: remaining };
}

function isOnlyMoney(line: string): boolean {
  return moneyTokens(line).length > 0 && cleanDescription(line).length === 0;
}

function descriptionFrom(dateRemainder: string, rest: string[]): string {
  const parts: string[] = [];
  const first = cleanDescription(dateRemainder);
  if (first) parts.push(first);
  for (const line of rest) {
    if (FX_RE.test(line)) continue;
    if (canonicalType(line)) continue;
    if (SUMMARY_RE.test(line)) continue;
    const cleaned = cleanDescription(line);
    if (!cleaned) continue;
    parts.push(cleaned);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function cleanDescription(line: string): string {
  return stripMoney(line).replace(/^[-–—\s]+|[-–—\s]+$/g, "").trim();
}

function stripMoney(line: string): string {
  return line.replace(moneyPattern(), " ").replace(/\s+/g, " ").trim();
}

function canonicalType(line: string): string | null {
  const key = stripMoney(line).trim().toLowerCase().replace(/\s+/g, " ");
  return TYPE_CANON[key] ?? null;
}

function defaultType(direction: "in" | "out", description: string): string {
  if (/^round up$/i.test(description)) return "Transfer";
  if (/^(to|from)\s+(high interest|regular saver)\b/i.test(description)) return "Transfer";
  return direction === "in" ? "Payment" : "Purchase";
}

function moneyTokens(line: string): MoneyToken[] {
  const tokens: MoneyToken[] = [];
  for (const match of line.matchAll(moneyPattern())) {
    const value = roundPence(Number(match[3].replace(/,/g, "")));
    if (!Number.isFinite(value)) continue;
    const sign = match[1] === "-" || match[2] === "-" ? "-" : match[1] === "+" || match[2] === "+" ? "+" : null;
    tokens.push({ sign, value });
  }
  return tokens;
}

function firstUnsigned(tokens: MoneyToken[]): number | undefined {
  return tokens.find((token) => token.sign === null)?.value ?? tokens[0]?.value;
}

function inferOpening(row: ImportTransactionsInput["transactions"][number]): number {
  const signed = row.direction === "out" ? -row.amount_gbp : row.amount_gbp;
  return roundPence(row.balance_gbp - signed);
}

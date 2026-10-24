import { normaliseIsoDate } from "@/lib/spending/dates";
import { roundPence } from "@/lib/spending/money";
import type { ImportTransactionsInput } from "@/lib/validators/transactions";

const ACCOUNT_NAME = "Chase UK";

const PERIOD_RE =
  /(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\s+(?:to|[-–—])\s+(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/i;

const DATE_LINE_RE = /^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\b\s*(.*)$/;

function moneyPattern(): RegExp {
  return /([+-])?\s*£\s*([\d,]+\.\d{2})/g;
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

/**
 * Parse text extracted from a Chase UK statement PDF.
 * Each transaction is a dated line plus the type (and, for a foreign
 * purchase, an exchange-rate line) printed underneath. Amounts are signed:
 * plus is money in, minus is money out, followed by the running balance.
 */
export function parseChaseStatementText(text: string): ImportTransactionsInput {
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
  let previousBalance = openingFromSummary;

  for (const block of transactionBlocks(lines)) {
    const parsed = parseBlock(block, previousBalance);
    if (!parsed) continue;
    if (parsed.kind === "opening") {
      previousBalance = parsed.balance;
      continue;
    }
    if (parsed.kind === "closing") continue;
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
    closingFromSummary ?? transactions[transactions.length - 1]?.balance_gbp;

  const statementMonth =
    (periodEnd ? periodEnd.slice(0, 7) : null) ??
    transactions.reduce((latest, row) => (row.date > latest ? row.date : latest), transactions[0].date).slice(0, 7);

  return {
    account: ACCOUNT_NAME,
    statementMonth,
    ...(openingBalance !== undefined ? { openingBalance } : {}),
    ...(closingBalance !== undefined ? { closingBalance } : {}),
    transactions,
  };
}

function normaliseStatement(text: string): string {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/\u00a0/g, " ")
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

function parseBlock(
  block: string[],
  previousBalance: number | undefined
):
  | { kind: "row"; row: ImportTransactionsInput["transactions"][number] }
  | { kind: "opening"; balance: number }
  | { kind: "closing" }
  | null {
  const [first, ...rest] = block;
  const dateMatch = DATE_LINE_RE.exec(first);
  if (!dateMatch) return null;
  const iso = normaliseIsoDate(`${dateMatch[1]} ${dateMatch[2]} ${dateMatch[3]}`);
  if (!iso) return null;

  const tokens = block.flatMap((line) => (FX_RE.test(line) ? [] : moneyTokens(line)));
  const description = descriptionFrom(dateMatch[4] ?? "", rest);
  if (!description) return null;

  if (/^(opening balance|balance brought forward|brought forward)$/i.test(description)) {
    const balance = tokens.at(-1)?.value;
    return balance === undefined ? null : { kind: "opening", balance };
  }
  if (/^(closing balance|balance carried forward|carried forward)$/i.test(description)) {
    return { kind: "closing" };
  }

  const typeLine = rest.map((line) => canonicalType(line)).find((type) => type !== null) ?? null;
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
    if (amount === 0) return null;
  } else {
    throw new ChaseStatementParseError(
      `Could not read the amount for "${description}" on ${iso}.`
    );
  }

  if (!Number.isFinite(amount) || amount < 0) {
    throw new ChaseStatementParseError(
      `Could not read the amount for "${description}" on ${iso}.`
    );
  }

  const type = typeLine ?? defaultType(direction, description);
  return {
    kind: "row",
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
  const key = line.trim().toLowerCase().replace(/\s+/g, " ");
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
    const value = roundPence(Number(match[2].replace(/,/g, "")));
    if (!Number.isFinite(value)) continue;
    tokens.push({ sign: match[1] === "+" || match[1] === "-" ? match[1] : null, value });
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

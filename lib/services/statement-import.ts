import { checkStatementBalances, type BalanceCheck } from "@/lib/spending/balances";
import {
  parseChaseStatementText,
  type StatementRowWarning,
} from "@/lib/spending/chase-statement";
import type { ImportTransactionsInput } from "@/lib/validators/transactions";
import { importTransactions, type ImportResult } from "@/lib/services/transactions";

export interface StatementPreview {
  statement: ImportTransactionsInput;
  balanceCheck: BalanceCheck;
  warnings: StatementRowWarning[];
}

export function previewChaseStatement(text: string): StatementPreview {
  const { statement, warnings } = parseForImport(text);
  return { statement, warnings, balanceCheck: balanceFor(statement) };
}

export function saveChaseStatement(text: string): ImportResult & { statementMonth: string } {
  const { statement } = parseForImport(text);
  const result = importTransactions(statement);
  return { ...result, statementMonth: statement.statementMonth };
}

function parseForImport(text: string): {
  statement: ImportTransactionsInput;
  warnings: StatementRowWarning[];
} {
  const { warnings, ...statement } = parseChaseStatementText(text);
  return { warnings, statement };
}

function balanceFor(statement: ImportTransactionsInput): BalanceCheck {
  return checkStatementBalances({
    openingBalance: statement.openingBalance,
    closingBalance: statement.closingBalance,
    transactions: statement.transactions.map((row) => ({
      amountGbp: row.amount_gbp,
      direction: row.direction,
      balanceGbp: row.balance_gbp,
    })),
  });
}

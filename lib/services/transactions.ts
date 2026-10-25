import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  accounts,
  transactionCategoryRules,
  transactions,
  type CategoryRuleMatchType,
} from "@/db/schema";
import { checkStatementBalances, type BalanceCheck } from "@/lib/spending/balances";
import { transactionFingerprint } from "@/lib/spending/hash";
import { cleanMerchant, inferIsTransfer } from "@/lib/spending/merchant";
import { roundPence, signedAmount } from "@/lib/spending/money";
import { matchBuiltinCategory } from "@/lib/spending/builtin-rules";
import { matchCategoryRule, type CategoryRule } from "@/lib/spending/rules";
import type {
  ImportTransactionsInput,
  UpdateTransactionInput,
} from "@/lib/validators/transactions";

export interface ImportResult {
  inserted: number;
  skipped: number;
  balanceCheck: BalanceCheck;
  accountId: string;
  importBatchId: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function timestampForIndex(index: number): string {
  const date = new Date(Date.now() + index);
  const pad = (value: number, width = 2) => String(value).padStart(width, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}`;
}

function listRules(): CategoryRule[] {
  return db
    .select()
    .from(transactionCategoryRules)
    .all()
    .map((row) => ({
      id: row.id,
      pattern: row.pattern,
      matchType: row.matchType,
      category: row.category,
      isTransfer: row.isTransfer,
      priority: row.priority,
    }));
}

export function createCategoryRule(input: {
  pattern: string;
  matchType: CategoryRuleMatchType;
  category: string;
  isTransfer?: boolean;
  priority?: number;
}): CategoryRule {
  const id = randomUUID();
  db.insert(transactionCategoryRules)
    .values({
      id,
      pattern: input.pattern,
      matchType: input.matchType,
      category: input.category,
      isTransfer: input.isTransfer ?? false,
      priority: input.priority ?? 100,
    })
    .run();
  const [row] = db
    .select()
    .from(transactionCategoryRules)
    .where(eq(transactionCategoryRules.id, id))
    .all();
  return {
    id: row.id,
    pattern: row.pattern,
    matchType: row.matchType,
    category: row.category,
    isTransfer: row.isTransfer,
    priority: row.priority,
  };
}

export function importTransactions(
  input: ImportTransactionsInput
): ImportResult {
  const rules = listRules();
  const balanceCheck = checkStatementBalances({
    openingBalance: input.openingBalance,
    closingBalance: input.closingBalance,
    transactions: input.transactions.map((tx) => ({
      amountGbp: tx.amount_gbp,
      direction: tx.direction,
      balanceGbp: tx.balance_gbp,
    })),
  });

  return db.transaction((tx) => {
    const account = resolveAccount(tx, input.account);
    const importBatchId = randomUUID();
    let inserted = 0;
    let skipped = 0;

    input.transactions.forEach((row, index) => {
      const descriptionRaw = row.description.trim();
      const merchant = cleanMerchant(descriptionRaw);
      const importedCategory = row.category?.trim() ? row.category.trim() : null;
      const userRule = matchCategoryRule(rules, descriptionRaw, merchant);
      // A category on the import row was chosen already. Built-in keywords
      // fill the gap for statement lines that arrive uncategorised.
      const builtin =
        userRule || importedCategory
          ? null
          : matchBuiltinCategory(descriptionRaw, merchant);
      const category = userRule?.category ?? importedCategory ?? builtin?.category ?? null;
      const isTransfer = inferIsTransfer({
        description: descriptionRaw,
        category,
        explicit: userRule
          ? userRule.isTransfer
          : builtin
            ? builtin.isTransfer
            : row.is_transfer,
      });
      const categorySource = userRule
        ? "rule"
        : importedCategory
          ? "import"
          : builtin
            ? "builtin"
            : null;
      const amount = roundPence(row.amount_gbp);
      const balanceAfter = roundPence(row.balance_gbp);
      const id = transactionFingerprint({
        accountId: account.id,
        date: row.date,
        amount,
        direction: row.direction,
        descriptionRaw,
        balanceAfter,
      });

      const result = tx
        .insert(transactions)
        .values({
          id,
          accountId: account.id,
          date: row.date,
          descriptionRaw,
          merchant,
          amountGbp: signedAmount(amount, row.direction),
          direction: row.direction,
          type: row.type,
          balanceAfterGbp: balanceAfter,
          category,
          categorySource,
          isTransfer,
          subscriptionId: null,
          statementMonth: input.statementMonth,
          importBatchId,
          notes: null,
          createdAt: timestampForIndex(index),
        })
        .onConflictDoNothing()
        .run();

      if (result.changes > 0) inserted += 1;
      else skipped += 1;
    });

    return {
      inserted,
      skipped,
      balanceCheck,
      accountId: account.id,
      importBatchId,
    };
  });
}

type AccountWriter = Pick<typeof db, "select" | "insert">;

function resolveAccount(tx: AccountWriter, accountRef: string) {
  const ref = accountRef.trim();
  const all = tx.select().from(accounts).all();
  const byId = all.find((account) => account.id === ref);
  if (byId) return byId;
  const byName = all.find(
    (account) => account.name.toLowerCase() === ref.toLowerCase()
  );
  if (byName) return byName;

  const name = UUID_RE.test(ref) ? "Chase UK" : ref;
  const existingNamed = all.find(
    (account) => account.name.toLowerCase() === name.toLowerCase()
  );
  if (existingNamed) return existingNamed;

  const id = randomUUID();
  const sortOrder =
    all.reduce((max, account) => Math.max(max, account.sortOrder), -1) + 1;
  tx.insert(accounts)
    .values({
      id,
      name,
      type: "ASSET",
      category: "CASH",
      currencyCode: "GBP",
      institution: name.toLowerCase() === "chase uk" ? "Chase UK" : name,
      wrapper: "NONE",
      isActive: true,
      sortOrder,
    })
    .run();

  const [created] = tx.select().from(accounts).where(eq(accounts.id, id)).all();
  return created;
}

export function updateTransaction(id: string, input: UpdateTransactionInput) {
  const existing = db
    .select()
    .from(transactions)
    .where(eq(transactions.id, id))
    .all()[0];
  if (!existing) throw new Error(`Transaction not found: ${id}`);

  const category =
    input.category !== undefined ? input.category : existing.category;
  const isTransfer =
    input.isTransfer !== undefined
      ? input.isTransfer
      : input.category !== undefined
        ? inferIsTransfer({
            description: existing.descriptionRaw,
            category,
            explicit: null,
          })
        : existing.isTransfer;

  db.update(transactions)
    .set({
      ...(input.category !== undefined && { category: input.category }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.category !== undefined || input.isTransfer !== undefined
        ? {
            isTransfer,
            categorySource: input.category !== undefined ? "manual" : existing.categorySource,
          }
        : {}),
    })
    .where(eq(transactions.id, id))
    .run();

  if (input.applyToFuture && category) {
    upsertFutureRule({
      pattern: existing.merchant,
      category,
      isTransfer,
    });
  }

  const [row] = db
    .select()
    .from(transactions)
    .where(eq(transactions.id, id))
    .all();
  return row;
}

function upsertFutureRule(input: {
  pattern: string;
  category: string;
  isTransfer: boolean;
}) {
  const pattern = input.pattern.trim();
  if (pattern.length < 2) return;
  const existing = db
    .select()
    .from(transactionCategoryRules)
    .all()
    .find(
      (rule) =>
        rule.matchType === "contains" &&
        rule.pattern.toLowerCase() === pattern.toLowerCase()
    );
  if (existing) {
    db.update(transactionCategoryRules)
      .set({
        category: input.category,
        isTransfer: input.isTransfer,
      })
      .where(eq(transactionCategoryRules.id, existing.id))
      .run();
    return;
  }
  createCategoryRule({
    pattern,
    matchType: "contains",
    category: input.category,
    isTransfer: input.isTransfer,
    priority: 50,
  });
}

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { subscriptions, transactions } from "@/db/schema";
import { currentStatementMonth } from "@/lib/spending/dates";
import { merchantKey } from "@/lib/spending/merchant";
import { roundPence } from "@/lib/spending/money";
import { buildSpendingReport } from "@/lib/spending/report";
import {
  subscriptionCategoryFor,
  type SubscriptionRef,
} from "@/lib/spending/recurring";
import type { SpendingReport, SpendingTransaction } from "@/lib/spending/types";
import { createSubscription } from "@/lib/services/subscriptions";
import type { AddRecurringSubscriptionInput } from "@/lib/validators/transactions";

function toSpendingTransaction(
  row: typeof transactions.$inferSelect
): SpendingTransaction {
  return {
    id: row.id,
    accountId: row.accountId,
    date: row.date,
    descriptionRaw: row.descriptionRaw,
    merchant: row.merchant,
    amountGbp: row.amountGbp,
    direction: row.direction,
    type: row.type,
    balanceAfterGbp: row.balanceAfterGbp,
    category: row.category,
    categorySource: row.categorySource,
    isTransfer: row.isTransfer,
    subscriptionId: row.subscriptionId,
    statementMonth: row.statementMonth,
    notes: row.notes,
    createdAt: row.createdAt,
  };
}

export function listSpendingTransactions(): SpendingTransaction[] {
  return db
    .select()
    .from(transactions)
    .all()
    .map(toSpendingTransaction);
}

export function getSpendingReport(month?: string | null): SpendingReport {
  const rows = listSpendingTransactions();
  const subs: SubscriptionRef[] = db
    .select()
    .from(subscriptions)
    .all()
    .map((row) => ({
      id: row.id,
      name: row.name,
      costGbp: row.costGbp,
      billingCycle: row.billingCycle,
      status: row.status,
    }));
  const months = [...new Set(rows.map((row) => row.statementMonth))].sort();
  const selected =
    month && months.includes(month)
      ? month
      : (months.at(-1) ?? month ?? currentStatementMonth());
  const monthList = months.includes(selected)
    ? months
    : [...months, selected].sort();
  return buildSpendingReport({
    month: selected,
    months: monthList,
    transactions: rows,
    subscriptions: subs,
  });
}

export function addRecurringSubscription(input: AddRecurringSubscriptionInput) {
  const subscription = createSubscription({
    name: input.merchant,
    costGbp: roundPence(input.costGbp),
    billingCycle: "monthly",
    category: subscriptionCategoryFor(input.spendingCategory ?? null),
    notes: "Added from spending",
  });

  const key = merchantKey(input.merchant);
  const cost = roundPence(input.costGbp);
  const rows = db.select().from(transactions).all();
  for (const row of rows) {
    if (row.direction !== "out" || row.isTransfer) continue;
    if (merchantKey(row.merchant) !== key) continue;
    if (Math.abs(Math.abs(row.amountGbp) - cost) >= 0.02) continue;
    db.update(transactions)
      .set({ subscriptionId: subscription.id })
      .where(eq(transactions.id, row.id))
      .run();
  }

  return subscription;
}

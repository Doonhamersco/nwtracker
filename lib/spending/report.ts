import {
  categorySpend,
  monthTotals,
  previousMonthTotals,
  spendTrend,
  topMerchants,
} from "@/lib/spending/aggregates";
import { previousStatementMonth } from "@/lib/spending/dates";
import {
  detectRecurring,
  findDuplicateSubscriptions,
  type SubscriptionRef,
} from "@/lib/spending/recurring";
import type { SpendingReport, SpendingTransaction } from "@/lib/spending/types";

const SUGGESTED_CATEGORIES = [
  "Groceries",
  "Eating out",
  "Transport",
  "Bills",
  "Rent",
  "Shopping",
  "Subscriptions/entertainment",
  "Leisure",
  "Cash",
  "Income/Transfers in",
  "Savings transfers",
  "Savings (round-ups)",
  "PayPal/transfers to people",
  "Gambling",
  "Other",
];

export function buildSpendingReport(input: {
  month: string;
  months: string[];
  transactions: SpendingTransaction[];
  subscriptions: SubscriptionRef[];
}): SpendingReport {
  const previous = previousMonthTotals(input.transactions, input.month);
  const observed = input.transactions
    .map((tx) => tx.category)
    .filter((category): category is string => Boolean(category));
  const categories = [...new Set([...SUGGESTED_CATEGORIES, ...observed])].sort(
    (a, b) => a.localeCompare(b)
  );

  const monthTransactions = input.transactions
    .filter((tx) => tx.statementMonth === input.month)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  return {
    month: input.month,
    months: input.months,
    totals: monthTotals(input.transactions, input.month),
    previous,
    byCategory: categorySpend(
      input.transactions,
      input.month,
      previousStatementMonth(input.month)
    ),
    trend: spendTrend(input.transactions),
    topMerchants: topMerchants(input.transactions, input.month),
    transactions: monthTransactions,
    categories,
    recurring: detectRecurring(input.transactions, input.subscriptions),
    duplicateSubscriptions: findDuplicateSubscriptions(input.subscriptions),
  };
}

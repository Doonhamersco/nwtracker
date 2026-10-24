import { previousStatementMonth } from "@/lib/spending/dates";
import { roundPence } from "@/lib/spending/money";
import type {
  CategorySpend,
  MerchantSpend,
  MonthTrend,
  SpendingTotals,
  SpendingTransaction,
} from "@/lib/spending/types";

export function monthTotals(
  transactions: SpendingTransaction[],
  month: string
): SpendingTotals {
  let spend = 0;
  let income = 0;
  let transferOut = 0;
  for (const tx of transactions) {
    if (tx.statementMonth !== month) continue;
    if (tx.isTransfer) {
      if (tx.direction === "out") transferOut += Math.abs(tx.amountGbp);
      continue;
    }
    if (tx.direction === "out") spend += Math.abs(tx.amountGbp);
    else income += tx.amountGbp;
  }
  spend = roundPence(spend);
  income = roundPence(income);
  const savings = roundPence(income - spend);
  return {
    spend,
    income,
    savings,
    savingsRate: income > 0 ? savings / income : null,
    transferOut: roundPence(transferOut),
  };
}

export function categorySpend(
  transactions: SpendingTransaction[],
  month: string,
  previousMonth: string
): CategorySpend[] {
  const current = spendByCategory(transactions, month);
  const previous = spendByCategory(transactions, previousMonth);
  const names = new Set([...current.keys(), ...previous.keys()]);
  const rows: CategorySpend[] = [];
  for (const category of names) {
    const spend = roundPence(current.get(category) ?? 0);
    const previousSpend = roundPence(previous.get(category) ?? 0);
    if (spend === 0 && previousSpend === 0) continue;
    rows.push({
      category,
      spend,
      previousSpend,
      change: roundPence(spend - previousSpend),
    });
  }
  rows.sort((a, b) => b.spend - a.spend || a.category.localeCompare(b.category));
  return rows;
}

function spendByCategory(
  transactions: SpendingTransaction[],
  month: string
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.statementMonth !== month || tx.isTransfer || tx.direction !== "out") {
      continue;
    }
    const category = tx.category ?? "Uncategorised";
    totals.set(category, (totals.get(category) ?? 0) + Math.abs(tx.amountGbp));
  }
  return totals;
}

export function spendTrend(transactions: SpendingTransaction[]): MonthTrend[] {
  const months = new Set(transactions.map((tx) => tx.statementMonth));
  return [...months].sort().map((month) => {
    const totals = monthTotals(transactions, month);
    return { month, spend: totals.spend, income: totals.income };
  });
}

export function topMerchants(
  transactions: SpendingTransaction[],
  month: string,
  limit = 8
): MerchantSpend[] {
  const grouped = new Map<string, MerchantSpend>();
  for (const tx of transactions) {
    if (tx.statementMonth !== month || tx.isTransfer || tx.direction !== "out") {
      continue;
    }
    const key = tx.merchant.toLowerCase();
    const existing = grouped.get(key);
    if (existing) {
      existing.spend = roundPence(existing.spend + Math.abs(tx.amountGbp));
      existing.count += 1;
    } else {
      grouped.set(key, {
        merchant: tx.merchant,
        spend: roundPence(Math.abs(tx.amountGbp)),
        count: 1,
      });
    }
  }
  return [...grouped.values()]
    .sort((a, b) => b.spend - a.spend || a.merchant.localeCompare(b.merchant))
    .slice(0, limit);
}

export function previousMonthTotals(
  transactions: SpendingTransaction[],
  month: string
): { month: string; spend: number; income: number } {
  const previous = previousStatementMonth(month);
  const totals = monthTotals(transactions, previous);
  return { month: previous, spend: totals.spend, income: totals.income };
}

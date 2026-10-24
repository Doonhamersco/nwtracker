import { buildSpendingReport } from "@/lib/spending/report";
import type { SpendingReport, SpendingTransaction } from "@/lib/spending/types";
import type { SubscriptionRef } from "@/lib/spending/recurring";

/**
 * Frozen sample for the dev-only spending preview. Not a real statement.
 */
export function previewSpendingReport(month?: string | null): SpendingReport {
  const transactions = previewTransactions();
  const months = ["2026-08", "2026-09", "2026-10"];
  const selected = month && months.includes(month) ? month : "2026-10";
  return buildSpendingReport({
    month: selected,
    months,
    transactions,
    subscriptions: previewSubscriptions(),
  });
}

function previewSubscriptions(): SubscriptionRef[] {
  return [
    {
      id: "sub-rent",
      name: "Harbour Rent",
      costGbp: 850,
      billingCycle: "monthly",
      status: "active",
    },
    {
      id: "sub-transit",
      name: "City Transit",
      costGbp: 52,
      billingCycle: "monthly",
      status: "active",
    },
    {
      id: "sub-transit-pass",
      name: "City Transit Pass",
      costGbp: 52,
      billingCycle: "monthly",
      status: "active",
    },
  ];
}

function previewTransactions(): SpendingTransaction[] {
  const rows: Array<{
    month: string;
    date: string;
    merchant: string;
    amount: number;
    direction: "in" | "out";
    category: string;
    transfer?: boolean;
  }> = [
    { month: "2026-08", date: "2026-08-01", merchant: "Northwind Payroll", amount: 2400, direction: "in", category: "Income/Transfers in" },
    { month: "2026-08", date: "2026-08-02", merchant: "Harbour Rent", amount: 850, direction: "out", category: "Bills" },
    { month: "2026-08", date: "2026-08-03", merchant: "To Rainy Day", amount: 200, direction: "out", category: "Savings transfers", transfer: true },
    { month: "2026-08", date: "2026-08-04", merchant: "Green Grocer", amount: 46.2, direction: "out", category: "Groceries" },
    { month: "2026-08", date: "2026-08-11", merchant: "Green Grocer", amount: 38.4, direction: "out", category: "Groceries" },
    { month: "2026-08", date: "2026-08-18", merchant: "Harbour Cafe", amount: 18.5, direction: "out", category: "Eating out" },
    { month: "2026-08", date: "2026-08-20", merchant: "City Transit", amount: 48, direction: "out", category: "Transport" },
    { month: "2026-08", date: "2026-08-22", merchant: "Lumen Stream", amount: 12.99, direction: "out", category: "Subscriptions/entertainment" },
    { month: "2026-08", date: "2026-08-25", merchant: "Atlas Gym", amount: 39, direction: "out", category: "Leisure" },
    { month: "2026-08", date: "2026-08-28", merchant: "Paper & Co", amount: 22, direction: "out", category: "Shopping" },

    { month: "2026-09", date: "2026-09-01", merchant: "Northwind Payroll", amount: 2400, direction: "in", category: "Income/Transfers in" },
    { month: "2026-09", date: "2026-09-02", merchant: "Harbour Rent", amount: 850, direction: "out", category: "Bills" },
    { month: "2026-09", date: "2026-09-03", merchant: "To Rainy Day", amount: 150, direction: "out", category: "Savings transfers", transfer: true },
    { month: "2026-09", date: "2026-09-05", merchant: "Green Grocer", amount: 62.15, direction: "out", category: "Groceries" },
    { month: "2026-09", date: "2026-09-14", merchant: "Green Grocer", amount: 51.8, direction: "out", category: "Groceries" },
    { month: "2026-09", date: "2026-09-16", merchant: "Harbour Cafe", amount: 27.4, direction: "out", category: "Eating out" },
    { month: "2026-09", date: "2026-09-19", merchant: "Night Market", amount: 44.2, direction: "out", category: "Eating out" },
    { month: "2026-09", date: "2026-09-20", merchant: "City Transit", amount: 55, direction: "out", category: "Transport" },
    { month: "2026-09", date: "2026-09-22", merchant: "Lumen Stream", amount: 12.99, direction: "out", category: "Subscriptions/entertainment" },
    { month: "2026-09", date: "2026-09-25", merchant: "Atlas Gym", amount: 39, direction: "out", category: "Leisure" },
    { month: "2026-09", date: "2026-09-27", merchant: "Field Goods", amount: 186.4, direction: "out", category: "Shopping" },

    { month: "2026-10", date: "2026-10-01", merchant: "Northwind Payroll", amount: 2450, direction: "in", category: "Income/Transfers in" },
    { month: "2026-10", date: "2026-10-02", merchant: "Harbour Rent", amount: 850, direction: "out", category: "Bills" },
    { month: "2026-10", date: "2026-10-03", merchant: "To Rainy Day", amount: 250, direction: "out", category: "Savings transfers", transfer: true },
    { month: "2026-10", date: "2026-10-04", merchant: "Green Grocer", amount: 41.75, direction: "out", category: "Groceries" },
    { month: "2026-10", date: "2026-10-12", merchant: "Green Grocer", amount: 54.1, direction: "out", category: "Groceries" },
    { month: "2026-10", date: "2026-10-15", merchant: "Harbour Cafe", amount: 21.3, direction: "out", category: "Eating out" },
    { month: "2026-10", date: "2026-10-18", merchant: "City Transit", amount: 52, direction: "out", category: "Transport" },
    { month: "2026-10", date: "2026-10-22", merchant: "Lumen Stream", amount: 12.99, direction: "out", category: "Subscriptions/entertainment" },
    { month: "2026-10", date: "2026-10-25", merchant: "Atlas Gym", amount: 39, direction: "out", category: "Leisure" },
    { month: "2026-10", date: "2026-10-26", merchant: "Paper & Co", amount: 64, direction: "out", category: "Shopping" },
  ];

  return rows.map((row, index) => {
    const signed = row.direction === "out" ? -row.amount : row.amount;
    return {
      id: `preview-${index}`,
      accountId: "preview-account",
      date: row.date,
      descriptionRaw: row.merchant,
      merchant: row.merchant,
      amountGbp: signed,
      direction: row.direction,
      type: row.transfer ? "Transfer" : row.direction === "in" ? "Payment" : "Purchase",
      balanceAfterGbp: 1200,
      category: row.category,
      categorySource: "import" as const,
      isTransfer: row.transfer ?? false,
      subscriptionId: row.merchant === "Harbour Rent" ? "sub-rent" : null,
      statementMonth: row.month,
      notes: null,
      createdAt: `${row.date}T12:00:00.000Z`,
    };
  });
}

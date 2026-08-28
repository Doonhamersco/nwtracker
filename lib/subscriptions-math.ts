import type { SubscriptionBillingCycle, SubscriptionStatus } from "@/db/schema";

export function monthlyEquivalent(
  costGbp: number,
  billingCycle: SubscriptionBillingCycle
): number {
  return billingCycle === "yearly" ? costGbp / 12 : costGbp;
}

export function activeMonthlyTotal(
  rows: Array<{
    status: SubscriptionStatus;
    costGbp: number;
    billingCycle: SubscriptionBillingCycle;
  }>
): number {
  return rows
    .filter((row) => row.status === "active")
    .reduce(
      (sum, row) => sum + monthlyEquivalent(row.costGbp, row.billingCycle),
      0
    );
}

import type {
  SubscriptionBillingCycle,
  SubscriptionCategory,
  SubscriptionStatus,
} from "@/db/schema";

export const BILLING_CYCLE_OPTIONS: Array<{
  value: SubscriptionBillingCycle;
  label: string;
}> = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export const CATEGORY_OPTIONS: Array<{
  value: SubscriptionCategory;
  label: string;
}> = [
  { value: "entertainment", label: "Entertainment" },
  { value: "software", label: "Software" },
  { value: "fitness", label: "Fitness" },
  { value: "food", label: "Food" },
  { value: "utilities", label: "Utilities" },
  { value: "shopping", label: "Shopping" },
  { value: "other", label: "Other" },
];

export const STATUS_OPTIONS: Array<{
  value: SubscriptionStatus;
  label: string;
}> = [
  { value: "active", label: "Active" },
  { value: "cancelled", label: "Cancelled" },
];

export function categoryLabel(category: SubscriptionCategory): string {
  return CATEGORY_OPTIONS.find((opt) => opt.value === category)?.label ?? category;
}

export function billingCycleLabel(cycle: SubscriptionBillingCycle): string {
  return BILLING_CYCLE_OPTIONS.find((opt) => opt.value === cycle)?.label ?? cycle;
}

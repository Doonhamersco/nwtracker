import { sqliteTable, text, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const subscriptionBillingCycleEnum = ["monthly", "yearly"] as const;
export const subscriptionStatusEnum = ["active", "cancelled"] as const;
export const subscriptionCategoryEnum = [
  "entertainment",
  "software",
  "fitness",
  "food",
  "utilities",
  "shopping",
  "other",
] as const;

export type SubscriptionBillingCycle =
  (typeof subscriptionBillingCycleEnum)[number];
export type SubscriptionStatus = (typeof subscriptionStatusEnum)[number];
export type SubscriptionCategory = (typeof subscriptionCategoryEnum)[number];

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  costGbp: real("cost_gbp").notNull(),
  billingCycle: text("billing_cycle", {
    enum: subscriptionBillingCycleEnum,
  }).notNull(),
  nextRenewalDate: text("next_renewal_date"),
  category: text("category", { enum: subscriptionCategoryEnum }).notNull(),
  status: text("status", { enum: subscriptionStatusEnum })
    .notNull()
    .default("active"),
  notes: text("notes"),
  cancelledAt: text("cancelled_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

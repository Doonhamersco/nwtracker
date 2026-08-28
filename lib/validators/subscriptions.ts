import { z } from "zod";
import {
  subscriptionBillingCycleEnum,
  subscriptionCategoryEnum,
  subscriptionStatusEnum,
} from "@/db/schema";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be ISO date (YYYY-MM-DD)");

export const createSubscriptionSchema = z.object({
  name: z.string().min(1).max(255),
  costGbp: z.number().nonnegative("costGbp must be zero or positive"),
  billingCycle: z.enum(subscriptionBillingCycleEnum),
  nextRenewalDate: isoDate.nullable().optional(),
  category: z.enum(subscriptionCategoryEnum),
  status: z.enum(subscriptionStatusEnum).optional(),
  notes: z.string().max(2000).nullable().optional(),
  cancelledAt: isoDate.nullable().optional(),
});

export const updateSubscriptionSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  costGbp: z.number().nonnegative().optional(),
  billingCycle: z.enum(subscriptionBillingCycleEnum).optional(),
  nextRenewalDate: isoDate.nullable().optional(),
  category: z.enum(subscriptionCategoryEnum).optional(),
  status: z.enum(subscriptionStatusEnum).optional(),
  notes: z.string().max(2000).nullable().optional(),
  cancelledAt: isoDate.nullable().optional(),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;

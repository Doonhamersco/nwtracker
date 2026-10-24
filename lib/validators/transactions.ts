import { z } from "zod";
import { transactionDirectionEnum } from "@/db/schema";
import { normaliseIsoDate } from "@/lib/spending/dates";

const statementDate = z.string().transform((value, ctx) => {
  const iso = normaliseIsoDate(value);
  if (!iso) {
    ctx.addIssue({
      code: "custom",
      message: "must be an ISO date (YYYY-MM-DD)",
    });
    return z.NEVER;
  }
  return iso;
});

export const importTransactionRowSchema = z.object({
  date: statementDate,
  description: z.string().trim().min(1).max(2000),
  type: z.string().trim().min(1).max(100),
  amount_gbp: z.number().nonnegative(),
  direction: z.enum(transactionDirectionEnum),
  balance_gbp: z.number(),
  category: z.string().trim().min(1).max(200).nullable().optional(),
  is_transfer: z.boolean().optional(),
});

export const importTransactionsSchema = z.object({
  account: z.string().trim().min(1).max(255),
  statementMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  openingBalance: z.number().optional(),
  closingBalance: z.number().optional(),
  transactions: z.array(importTransactionRowSchema).min(1).max(5000),
});

export const updateTransactionSchema = z
  .object({
    category: z.string().trim().min(1).max(200).nullable().optional(),
    isTransfer: z.boolean().optional(),
    notes: z.string().max(2000).nullable().optional(),
    applyToFuture: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.category !== undefined ||
      value.isTransfer !== undefined ||
      value.notes !== undefined,
    { message: "No changes" }
  );

export const addRecurringSubscriptionSchema = z.object({
  merchant: z.string().trim().min(1).max(255),
  costGbp: z.number().positive(),
  spendingCategory: z.string().trim().max(200).nullable().optional(),
});

export type ImportTransactionsInput = z.infer<typeof importTransactionsSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type AddRecurringSubscriptionInput = z.infer<
  typeof addRecurringSubscriptionSchema
>;

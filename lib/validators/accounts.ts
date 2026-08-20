import { z } from "zod";
import { accountTypeEnum, accountCategoryEnum } from "@/db/schema";

export const createAccountSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(accountTypeEnum),
  category: z.enum(accountCategoryEnum),
  currencyCode: z.string().min(1).max(10).default("GBP"),
  coingeckoId: z.string().optional(),
  institution: z.string().max(255).optional(),
  notes: z.string().max(2000).optional(),
  sortOrder: z.number().int().optional(),
});

export const updateAccountSchema = createAccountSchema.partial();

export const reorderAccountsSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});

export type CreateAccountInput = z.input<typeof createAccountSchema>;
export type UpdateAccountInput = z.input<typeof updateAccountSchema>;
export type ReorderAccountsInput = z.input<typeof reorderAccountsSchema>;

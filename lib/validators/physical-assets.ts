import { z } from "zod";
import { physicalAssetCategoryEnum } from "@/db/schema";
import { normaliseIsoDate } from "@/lib/spending/dates";

const isoDate = z
  .string()
  .refine((value) => normaliseIsoDate(value) === value, "must be YYYY-MM-DD");

const money = z.number().finite().nonnegative();

export const createPhysicalAssetSchema = z.object({
  name: z.string().trim().min(1).max(255),
  category: z.enum(physicalAssetCategoryEnum),
  valueGbp: money,
  purchaseDate: isoDate.nullable().optional(),
  purchasePriceGbp: money.nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const updatePhysicalAssetSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    category: z.enum(physicalAssetCategoryEnum).optional(),
    valueGbp: money.optional(),
    purchaseDate: isoDate.nullable().optional(),
    purchasePriceGbp: money.nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "No changes",
  });

export type CreatePhysicalAssetInput = z.infer<typeof createPhysicalAssetSchema>;
export type UpdatePhysicalAssetInput = z.infer<typeof updatePhysicalAssetSchema>;

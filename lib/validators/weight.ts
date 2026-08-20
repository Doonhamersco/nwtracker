import { z } from "zod";

export const createWeightSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be ISO date (YYYY-MM-DD)"),
  weightKg: z.number().positive().max(500),
});

export type CreateWeightInput = z.infer<typeof createWeightSchema>;

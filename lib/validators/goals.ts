import { z } from "zod";
import { goalMetricTypeEnum } from "@/db/schema";
import { accountCategoryEnum } from "@/db/schema";

export const createGoalSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  targetValue: z.number().positive("targetValue must be positive"),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "targetDate must be ISO date (YYYY-MM-DD)"),
  metricType: z.enum(goalMetricTypeEnum),
  linkedMetricId: z.string().uuid().optional(),
  linkedCategory: z.enum(accountCategoryEnum).optional(),
  baselineValue: z.number().optional(),
  baselineDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "baselineDate must be ISO date (YYYY-MM-DD)")
    .optional(),
  isActive: z.boolean().optional(),
});

export const updateGoalSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  targetValue: z.number().positive().optional(),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "targetDate must be ISO date (YYYY-MM-DD)")
    .optional(),
  isActive: z.boolean().optional(),
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;

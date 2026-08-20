import { z } from "zod";
import { goalMetricTypeEnum } from "@/db/schema";
import { accountCategoryEnum } from "@/db/schema";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be ISO date (YYYY-MM-DD)");

export const createGoalSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).nullable().optional(),
  targetValue: z.number().positive("targetValue must be positive"),
  targetDate: isoDate,
  metricType: z.enum(goalMetricTypeEnum),
  linkedMetricId: z.string().uuid().optional(),
  linkedCategory: z.enum(accountCategoryEnum).optional(),
  baselineValue: z.number().optional(),
  baselineDate: isoDate.optional(),
  isActive: z.boolean().optional(),
  completedAt: isoDate.nullable().optional(),
});

export const updateGoalSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  targetValue: z.number().positive().optional(),
  targetDate: isoDate.optional(),
  isActive: z.boolean().optional(),
  completedAt: isoDate.nullable().optional(),
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;

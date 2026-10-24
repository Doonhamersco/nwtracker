import { z } from "zod";
import { goalDirectionEnum, goalMetricTypeEnum } from "@/db/schema";
import { accountCategoryEnum } from "@/db/schema";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be ISO date (YYYY-MM-DD)");

const goalFields = {
  name: z.string().min(1).max(255),
  description: z.string().max(1000).nullable().optional(),
  targetValue: z.number(),
  targetDate: isoDate,
  metricType: z.enum(goalMetricTypeEnum),
  direction: z.enum(goalDirectionEnum).optional(),
  linkedMetricId: z.string().uuid().nullable().optional(),
  linkedCategory: z.enum(accountCategoryEnum).nullable().optional(),
  linkedAccountId: z.string().uuid().nullable().optional(),
  baselineValue: z.number().optional(),
  baselineDate: isoDate.optional(),
  isActive: z.boolean().optional(),
  completedAt: isoDate.nullable().optional(),
};

function targetAllowed(
  metricType: string | undefined,
  direction: string | undefined,
  targetValue: number
): boolean {
  const decrease = metricType === "DEBT_PAYOFF" || direction === "decrease";
  return decrease ? targetValue >= 0 : targetValue > 0;
}

function targetMessage(
  metricType: string | undefined,
  direction: string | undefined
): string {
  const decrease = metricType === "DEBT_PAYOFF" || direction === "decrease";
  return decrease
    ? "targetValue must be zero or positive"
    : "targetValue must be positive";
}

export const createGoalSchema = z.object(goalFields).superRefine((data, ctx) => {
  if (!targetAllowed(data.metricType, data.direction, data.targetValue)) {
    ctx.addIssue({
      code: "custom",
      path: ["targetValue"],
      message: targetMessage(data.metricType, data.direction),
    });
  }
});

export const updateGoalSchema = z
  .object({
    name: goalFields.name.optional(),
    description: goalFields.description,
    targetValue: z.number().optional(),
    targetDate: isoDate.optional(),
    metricType: goalFields.metricType.optional(),
    direction: goalFields.direction,
    linkedMetricId: goalFields.linkedMetricId,
    linkedCategory: goalFields.linkedCategory,
    linkedAccountId: goalFields.linkedAccountId,
    baselineValue: goalFields.baselineValue,
    baselineDate: goalFields.baselineDate,
    isActive: goalFields.isActive,
    completedAt: goalFields.completedAt,
  })
  .superRefine((data, ctx) => {
    if (data.targetValue === undefined) return;
    if (data.metricType === undefined && data.direction === undefined) {
      if (data.targetValue < 0) {
        ctx.addIssue({
          code: "custom",
          path: ["targetValue"],
          message: "targetValue must be zero or positive",
        });
      }
      return;
    }
    if (!targetAllowed(data.metricType, data.direction, data.targetValue)) {
      ctx.addIssue({
        code: "custom",
        path: ["targetValue"],
        message: targetMessage(data.metricType, data.direction),
      });
    }
  });

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;

import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be ISO date (YYYY-MM-DD)");

export const updateCareerPlanSchema = z.object({
  startDate: isoDate.optional(),
  dateOfBirth: isoDate.optional(),
  npa: z.number().int().min(50).max(75).optional(),
  sippAccessAge: z.number().int().min(50).max(75).optional(),
  policeContributionRate: z.number().min(0).max(0.5).optional(),
  accrualDivisor: z.number().positive().optional(),
  scottishHigherRateThreshold: z.number().positive().optional(),
  isaMonthlyGbp: z.number().min(0).optional(),
  expectedRealReturn: z.number().min(0).max(0.25).optional(),
  commutationFactor: z.number().positive().optional(),
  commuteFraction: z.number().min(0).max(1).optional(),
  payScale: z.array(z.number().positive()).min(1).max(20).optional(),
  projectionYears: z.number().int().min(1).max(50).optional(),
});

export type UpdateCareerPlanInput = z.infer<typeof updateCareerPlanSchema>;

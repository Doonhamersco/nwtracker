import { z } from "zod";

export const submitValuationSchema = z.object({
  accountId: z.string().uuid(),
  valueNative: z.number().finite(),
  isCarriedForward: z.boolean(),
});

export const submitMetricReadingSchema = z.object({
  metricId: z.string().uuid(),
  value: z.number().finite(),
  notes: z.string().optional(),
});

export const commitCheckinSchema = z.object({
  valuations: z.array(submitValuationSchema).min(1, "At least one valuation required"),
  metrics: z.array(submitMetricReadingSchema),
  notes: z.string().max(1000).optional(),
  isPartial: z.boolean().default(false),
  takenAt: z.string().datetime().optional(),
});

export type CommitCheckinPayload = z.infer<typeof commitCheckinSchema>;

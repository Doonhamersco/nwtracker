import { z } from "zod";

export const createEventSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be ISO date (YYYY-MM-DD)"),
  emoji: z.string().min(1).max(10),
  label: z.string().min(1).max(500),
});

export const updateEventSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be ISO date (YYYY-MM-DD)").optional(),
  emoji: z.string().min(1).max(10).optional(),
  label: z.string().min(1).max(500).optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

import { z } from "zod";
import { parseYouTubeVideoId } from "@/lib/youtube";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be ISO date (YYYY-MM-DD)");

const youtubeUrl = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((val) => parseYouTubeVideoId(val) !== null, {
    message: "Must be a valid YouTube URL or video ID",
  });

export const createDiarySchema = z.object({
  title: z.string().trim().min(1).max(255),
  recordedAt: isoDate,
  youtubeUrl,
  notes: z.string().max(5000).nullable().optional(),
});

export const updateDiarySchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  recordedAt: isoDate.optional(),
  youtubeUrl: youtubeUrl.optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export type CreateDiaryInput = z.infer<typeof createDiarySchema>;
export type UpdateDiaryInput = z.infer<typeof updateDiarySchema>;

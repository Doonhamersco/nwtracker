import { z } from "zod";
import { isDiaryObjectKey } from "@/lib/r2-keys";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be ISO date (YYYY-MM-DD)");

const objectKey = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((val) => isDiaryObjectKey(val), {
    message: "Invalid object key",
  });

export const createDiarySchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(255),
  recordedAt: isoDate,
  notes: z.string().max(5000).nullable().optional(),
  r2ObjectKey: objectKey,
  thumbObjectKey: objectKey.nullable().optional(),
  wrappedFileKey: z.string().min(1).max(200),
  wrapIv: z.string().min(1).max(64),
  chunkSize: z.number().int().positive(),
  ciphertextBytes: z.number().int().positive(),
  mimeType: z.string().min(1).max(100),
});

export const updateDiarySchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  recordedAt: isoDate.optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export const diaryCryptoSetupSchema = z.object({
  kdfSalt: z.string().min(8).max(200),
  verifierIv: z.string().min(8).max(64),
  verifierCt: z.string().min(8).max(200),
});

export const diaryPresignSchema = z.object({
  key: objectKey,
  purpose: z.enum(["put", "get"]),
});

export type CreateDiaryInput = z.infer<typeof createDiarySchema>;
export type UpdateDiaryInput = z.infer<typeof updateDiarySchema>;
export type DiaryCryptoSetupInput = z.infer<typeof diaryCryptoSetupSchema>;

import { randomUUID } from "crypto";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { videoDiaries, diaryCrypto } from "@/db/schema";
import { deleteDiaryObjects } from "@/lib/r2";
import type {
  CreateDiaryInput,
  UpdateDiaryInput,
  DiaryCryptoSetupInput,
} from "@/lib/validators/diaries";

export type VideoDiaryRow = typeof videoDiaries.$inferSelect;
export type DiaryCryptoRow = typeof diaryCrypto.$inferSelect;

export function listDiaries(): VideoDiaryRow[] {
  return db
    .select()
    .from(videoDiaries)
    .orderBy(desc(videoDiaries.recordedAt))
    .all();
}

export function getDiaryById(id: string): VideoDiaryRow | null {
  const [row] = db.select().from(videoDiaries).where(eq(videoDiaries.id, id)).all();
  return row ?? null;
}

export function createDiary(input: CreateDiaryInput): VideoDiaryRow {
  db.insert(videoDiaries)
    .values({
      id: input.id,
      title: input.title,
      recordedAt: input.recordedAt,
      notes: input.notes ?? null,
      youtubeVideoId: "",
      r2ObjectKey: input.r2ObjectKey,
      thumbObjectKey: input.thumbObjectKey ?? null,
      wrappedFileKey: input.wrappedFileKey,
      wrapIv: input.wrapIv,
      chunkSize: input.chunkSize,
      ciphertextBytes: input.ciphertextBytes,
      mimeType: input.mimeType,
    })
    .run();

  const [row] = db.select().from(videoDiaries).where(eq(videoDiaries.id, input.id)).all();
  return row;
}

export function updateDiary(id: string, input: UpdateDiaryInput): VideoDiaryRow {
  const existing = getDiaryById(id);
  if (!existing) throw new Error(`Video diary not found: ${id}`);

  db.update(videoDiaries)
    .set({
      ...(input.title !== undefined && { title: input.title }),
      ...(input.recordedAt !== undefined && { recordedAt: input.recordedAt }),
      ...(input.notes !== undefined && { notes: input.notes }),
    })
    .where(eq(videoDiaries.id, id))
    .run();

  const [row] = db.select().from(videoDiaries).where(eq(videoDiaries.id, id)).all();
  return row;
}

export function deleteDiary(id: string): void {
  const existing = getDiaryById(id);
  if (!existing) return;

  const keys = [existing.r2ObjectKey, existing.thumbObjectKey].filter(
    (k): k is string => Boolean(k)
  );
  if (keys.length > 0) {
    void deleteDiaryObjects(keys).catch((err) => {
      console.error("[deleteDiary] R2 cleanup failed", err);
    });
  }

  db.delete(videoDiaries).where(eq(videoDiaries.id, id)).run();
}

const CRYPTO_ID = "default";

export function getDiaryCrypto(): DiaryCryptoRow | null {
  const [row] = db.select().from(diaryCrypto).where(eq(diaryCrypto.id, CRYPTO_ID)).all();
  return row ?? null;
}

export function setupDiaryCrypto(input: DiaryCryptoSetupInput): DiaryCryptoRow {
  const existing = getDiaryCrypto();
  if (existing) throw new Error("Diary encryption is already configured");

  db.insert(diaryCrypto)
    .values({
      id: CRYPTO_ID,
      kdfSalt: input.kdfSalt,
      verifierIv: input.verifierIv,
      verifierCt: input.verifierCt,
    })
    .run();

  const [row] = db
    .select()
    .from(diaryCrypto)
    .where(eq(diaryCrypto.id, CRYPTO_ID))
    .all();
  return row;
}

export function newDiaryId(): string {
  return randomUUID();
}

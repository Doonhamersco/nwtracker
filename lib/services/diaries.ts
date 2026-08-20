import { randomUUID } from "crypto";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { videoDiaries } from "@/db/schema";
import { parseYouTubeVideoId } from "@/lib/youtube";
import type { CreateDiaryInput, UpdateDiaryInput } from "@/lib/validators/diaries";

export type VideoDiaryRow = typeof videoDiaries.$inferSelect;

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
  const youtubeVideoId = parseYouTubeVideoId(input.youtubeUrl);
  if (!youtubeVideoId) {
    throw new Error("Must be a valid YouTube URL or video ID");
  }

  const id = randomUUID();
  db.insert(videoDiaries)
    .values({
      id,
      title: input.title,
      recordedAt: input.recordedAt,
      youtubeVideoId,
      notes: input.notes ?? null,
    })
    .run();

  const [row] = db.select().from(videoDiaries).where(eq(videoDiaries.id, id)).all();
  return row;
}

export function updateDiary(id: string, input: UpdateDiaryInput): VideoDiaryRow {
  const existing = getDiaryById(id);
  if (!existing) throw new Error(`Video diary not found: ${id}`);

  let youtubeVideoId: string | undefined;
  if (input.youtubeUrl !== undefined) {
    const parsed = parseYouTubeVideoId(input.youtubeUrl);
    if (!parsed) {
      throw new Error("Must be a valid YouTube URL or video ID");
    }
    youtubeVideoId = parsed;
  }

  db.update(videoDiaries)
    .set({
      ...(input.title !== undefined && { title: input.title }),
      ...(input.recordedAt !== undefined && { recordedAt: input.recordedAt }),
      ...(youtubeVideoId !== undefined && { youtubeVideoId }),
      ...(input.notes !== undefined && { notes: input.notes }),
    })
    .where(eq(videoDiaries.id, id))
    .run();

  const [row] = db.select().from(videoDiaries).where(eq(videoDiaries.id, id)).all();
  return row;
}

export function deleteDiary(id: string): void {
  db.delete(videoDiaries).where(eq(videoDiaries.id, id)).run();
}

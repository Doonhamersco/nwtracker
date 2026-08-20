import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetAllTables } from "./helpers/test-db";

vi.mock("@/db/client", async () => {
  const { createTestDb } = await import("./helpers/test-db");
  const { db, sqlite } = createTestDb();
  return { db, _sqlite: sqlite };
});

const clientModule = await import("@/db/client");
const sqlite = (clientModule as unknown as { _sqlite: import("better-sqlite3").Database })._sqlite;

const { createDiary, updateDiary, deleteDiary, listDiaries, getDiaryById } =
  await import("@/lib/services/diaries");

beforeEach(() => {
  resetAllTables(sqlite);
});

const VIDEO_ID = "dQw4w9WgXcQ";

describe("createDiary", () => {
  it("inserts a diary and stores the parsed video ID", () => {
    const diary = createDiary({
      title: "Q1 check-in",
      recordedAt: "2026-03-15",
      youtubeUrl: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
      notes: "Feeling good.",
    });

    expect(diary.id).toBeDefined();
    expect(diary.title).toBe("Q1 check-in");
    expect(diary.recordedAt).toBe("2026-03-15");
    expect(diary.youtubeVideoId).toBe(VIDEO_ID);
    expect(diary.notes).toBe("Feeling good.");
  });

  it("accepts a bare video ID", () => {
    const diary = createDiary({
      title: "Bare ID",
      recordedAt: "2026-01-01",
      youtubeUrl: VIDEO_ID,
    });

    expect(diary.youtubeVideoId).toBe(VIDEO_ID);
    expect(diary.notes).toBeNull();
  });
});

describe("listDiaries", () => {
  it("returns newest recorded date first", () => {
    createDiary({
      title: "Older",
      recordedAt: "2025-06-01",
      youtubeUrl: VIDEO_ID,
    });
    createDiary({
      title: "Newer",
      recordedAt: "2026-01-01",
      youtubeUrl: VIDEO_ID,
    });

    const listed = listDiaries();
    expect(listed.map((d) => d.title)).toEqual(["Newer", "Older"]);
  });
});

describe("updateDiary", () => {
  it("updates fields and re-parses a new YouTube URL", () => {
    const created = createDiary({
      title: "Original",
      recordedAt: "2026-01-01",
      youtubeUrl: VIDEO_ID,
    });

    const updated = updateDiary(created.id, {
      title: "Updated",
      notes: "New notes",
      youtubeUrl: "https://youtu.be/abcdefghijk",
    });

    expect(updated.title).toBe("Updated");
    expect(updated.notes).toBe("New notes");
    expect(updated.youtubeVideoId).toBe("abcdefghijk");
    expect(updated.recordedAt).toBe("2026-01-01");
  });

  it("throws when the diary does not exist", () => {
    expect(() => updateDiary("missing", { title: "Nope" })).toThrow(
      "Video diary not found: missing"
    );
  });
});

describe("deleteDiary / getDiaryById", () => {
  it("deletes a diary", () => {
    const created = createDiary({
      title: "To delete",
      recordedAt: "2026-01-01",
      youtubeUrl: VIDEO_ID,
    });

    expect(getDiaryById(created.id)?.title).toBe("To delete");
    deleteDiary(created.id);
    expect(getDiaryById(created.id)).toBeNull();
  });
});

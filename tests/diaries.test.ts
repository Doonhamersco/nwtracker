import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetAllTables } from "./helpers/test-db";
import { randomUUID } from "crypto";

vi.mock("@/db/client", async () => {
  const { createTestDb } = await import("./helpers/test-db");
  const { db, sqlite } = createTestDb();
  return { db, _sqlite: sqlite };
});

vi.mock("@/lib/r2", () => ({
  deleteDiaryObjects: vi.fn(async () => undefined),
}));

const clientModule = await import("@/db/client");
const sqlite = (clientModule as unknown as { _sqlite: import("better-sqlite3").Database })._sqlite;

const {
  createDiary,
  updateDiary,
  deleteDiary,
  listDiaries,
  getDiaryById,
  getDiaryCrypto,
  setupDiaryCrypto,
} = await import("@/lib/services/diaries");

beforeEach(() => {
  resetAllTables(sqlite);
});

const id = () => randomUUID();

function encryptedInput(overrides: Partial<Parameters<typeof createDiary>[0]> = {}) {
  const diaryId = overrides.id ?? id();
  return {
    id: diaryId,
    title: "Q1 check-in",
    recordedAt: "2026-03-15",
    notes: "Feeling good.",
    r2ObjectKey: `diaries/${diaryId}/video.enc`,
    thumbObjectKey: `diaries/${diaryId}/thumb.enc`,
    wrappedFileKey: "d3JhcHBlZA==",
    wrapIv: "aXZpdml2aXZpdg==",
    chunkSize: 1024 * 1024,
    ciphertextBytes: 4096,
    mimeType: "video/mp4",
    ...overrides,
  };
}

describe("createDiary", () => {
  it("inserts an encrypted diary", () => {
    const diary = createDiary(encryptedInput({ title: "Q1 check-in" }));
    expect(diary.id).toBeDefined();
    expect(diary.title).toBe("Q1 check-in");
    expect(diary.recordedAt).toBe("2026-03-15");
    expect(diary.r2ObjectKey).toContain("/video.enc");
    expect(diary.youtubeVideoId).toBe("");
    expect(diary.notes).toBe("Feeling good.");
  });
});

describe("listDiaries", () => {
  it("returns newest recorded date first", () => {
    createDiary(encryptedInput({ title: "Older", recordedAt: "2025-06-01" }));
    createDiary(encryptedInput({ title: "Newer", recordedAt: "2026-01-01" }));
    expect(listDiaries().map((d) => d.title)).toEqual(["Newer", "Older"]);
  });
});

describe("updateDiary", () => {
  it("updates metadata only", () => {
    const created = createDiary(encryptedInput({ title: "Original" }));
    const updated = updateDiary(created.id, { title: "Updated", notes: "New notes" });
    expect(updated.title).toBe("Updated");
    expect(updated.notes).toBe("New notes");
    expect(updated.r2ObjectKey).toBe(created.r2ObjectKey);
  });

  it("throws when the diary does not exist", () => {
    expect(() => updateDiary("00000000-0000-0000-0000-000000000000", { title: "Nope" })).toThrow(
      "Video diary not found"
    );
  });
});

describe("deleteDiary / getDiaryById", () => {
  it("deletes a diary", () => {
    const created = createDiary(encryptedInput({ title: "To delete" }));
    expect(getDiaryById(created.id)?.title).toBe("To delete");
    deleteDiary(created.id);
    expect(getDiaryById(created.id)).toBeNull();
  });
});

describe("diary crypto setup", () => {
  it("stores salt and verifier once", () => {
    expect(getDiaryCrypto()).toBeNull();
    const row = setupDiaryCrypto({
      kdfSalt: "c2FsdA==",
      verifierIv: "aXY=",
      verifierCt: "Y3Q=",
    });
    expect(row.kdfSalt).toBe("c2FsdA==");
    expect(() =>
      setupDiaryCrypto({ kdfSalt: "c2FsdA==", verifierIv: "aXY=", verifierCt: "Y3Q=" })
    ).toThrow("already configured");
  });
});

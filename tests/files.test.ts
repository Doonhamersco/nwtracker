import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetAllTables } from "./helpers/test-db";
import os from "os";
import path from "path";
import fs from "fs";

vi.mock("@/db/client", async () => {
  const { createTestDb } = await import("./helpers/test-db");
  const { db, sqlite } = createTestDb();
  return { db, _sqlite: sqlite };
});

const clientModule = await import("@/db/client");
const sqlite = (clientModule as unknown as { _sqlite: import("better-sqlite3").Database })._sqlite;

// Use a temp directory for file storage during tests
let tmpDir: string;

beforeEach(() => {
  resetAllTables(sqlite);
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nwtracker-test-"));
  process.env.DATA_DIR = tmpDir;
});

afterEach(() => {
  // Clean up temp directory
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

const { saveFile, getFile, listFiles, deleteFile } = await import("@/lib/services/files");

// ─── saveFile ─────────────────────────────────────────────────────────────────

describe("saveFile", () => {
  it("creates DB row and writes file to disk", () => {
    const data = Buffer.from("Hello, World!");
    const row = saveFile({
      displayName: "test.txt",
      mimeType: "text/plain",
      data,
      linkedToType: "ACCOUNT",
      linkedToId: "some-account-id",
    });

    expect(row.id).toBeDefined();
    expect(row.displayName).toBe("test.txt");
    expect(row.mimeType).toBe("text/plain");
    expect(row.sizeBytes).toBe(data.length);
    expect(row.linkedToType).toBe("ACCOUNT");
    expect(row.linkedToId).toBe("some-account-id");

    const absolutePath = path.join(tmpDir, row.storagePath);
    expect(fs.existsSync(absolutePath)).toBe(true);

    const saved = fs.readFileSync(absolutePath);
    expect(saved.toString()).toBe("Hello, World!");
  });
});

// ─── getFile ──────────────────────────────────────────────────────────────────

describe("getFile", () => {
  it("returns the row and absolutePath", () => {
    const data = Buffer.from("Some content");
    const row = saveFile({
      displayName: "document.pdf",
      mimeType: "application/pdf",
      data,
      linkedToType: "SNAPSHOT",
      linkedToId: "snap-123",
    });

    const result = getFile(row.id);

    expect(result).not.toBeNull();
    expect(result!.row.id).toBe(row.id);
    expect(result!.row.displayName).toBe("document.pdf");
    expect(fs.existsSync(result!.absolutePath)).toBe(true);
  });

  it("returns null for unknown id", () => {
    const result = getFile("00000000-0000-0000-0000-000000000000");
    expect(result).toBeNull();
  });
});

// ─── deleteFile ───────────────────────────────────────────────────────────────

describe("deleteFile", () => {
  it("removes DB row and file from disk", () => {
    const data = Buffer.from("Delete me");
    const row = saveFile({
      displayName: "to-delete.txt",
      mimeType: "text/plain",
      data,
      linkedToType: "GOAL",
      linkedToId: "goal-abc",
    });

    const absolutePath = path.join(tmpDir, row.storagePath);
    expect(fs.existsSync(absolutePath)).toBe(true);

    deleteFile(row.id);

    expect(fs.existsSync(absolutePath)).toBe(false);

    const result = getFile(row.id);
    expect(result).toBeNull();
  });

  it("does not throw if file id does not exist", () => {
    expect(() =>
      deleteFile("00000000-0000-0000-0000-000000000000")
    ).not.toThrow();
  });
});

// ─── listFiles ────────────────────────────────────────────────────────────────

describe("listFiles", () => {
  it("filters by linkedToType + linkedToId", () => {
    saveFile({
      displayName: "a.txt",
      mimeType: "text/plain",
      data: Buffer.from("a"),
      linkedToType: "ACCOUNT",
      linkedToId: "account-1",
    });
    saveFile({
      displayName: "b.txt",
      mimeType: "text/plain",
      data: Buffer.from("b"),
      linkedToType: "ACCOUNT",
      linkedToId: "account-1",
    });
    saveFile({
      displayName: "c.txt",
      mimeType: "text/plain",
      data: Buffer.from("c"),
      linkedToType: "ACCOUNT",
      linkedToId: "account-2",
    });
    saveFile({
      displayName: "d.txt",
      mimeType: "text/plain",
      data: Buffer.from("d"),
      linkedToType: "GOAL",
      linkedToId: "account-1",
    });

    const account1Files = listFiles("ACCOUNT", "account-1");
    expect(account1Files.length).toBe(2);
    expect(account1Files.every((f) => f.linkedToId === "account-1")).toBe(true);
    expect(account1Files.every((f) => f.linkedToType === "ACCOUNT")).toBe(true);

    const account2Files = listFiles("ACCOUNT", "account-2");
    expect(account2Files.length).toBe(1);

    const goalFiles = listFiles("GOAL", "account-1");
    expect(goalFiles.length).toBe(1);
    expect(goalFiles[0].displayName).toBe("d.txt");
  });

  it("returns empty array when no matches", () => {
    const result = listFiles("SNAPSHOT", "nonexistent");
    expect(result).toEqual([]);
  });
});

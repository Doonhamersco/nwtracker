import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { afterEach, describe, expect, it } from "vitest";
import { closeDatabase, openDatabase } from "@/db/client";
import { accounts } from "@/db/schema";
import { migrateLegacyData } from "@/lib/users/migrate";
import { userIdFromEmail } from "@/lib/users/identity";
import { eq } from "drizzle-orm";

const dirs: string[] = [];

function tempRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nw-migrate-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
  dirs.length = 0;
});

function legacyDb(root: string) {
  return path.join(root, "nwtracker.db");
}

function insertAccount(dbPath: string, name: string) {
  const db = openDatabase(dbPath);
  const id = randomUUID();
  db.insert(accounts)
    .values({ id, name, type: "ASSET", category: "CASH" })
    .run();
  closeDatabase(dbPath);
  return id;
}

describe("legacy data migration", () => {
  it("backs up, moves the owner data once, and leaves a second run untouched", () => {
    const root = tempRoot();
    const dbPath = legacyDb(root);
    const accountId = insertAccount(dbPath, "Current account");
    fs.mkdirSync(path.join(root, "files", "statement"), { recursive: true });
    fs.writeFileSync(path.join(root, "files", "statement", "note.txt"), "kept");
    fs.mkdirSync(path.join(root, "profile"), { recursive: true });
    fs.writeFileSync(path.join(root, "profile", "avatar"), "face");
    fs.writeFileSync(path.join(root, "strava-oauth.json"), JSON.stringify({ refreshToken: "kept" }));
    fs.writeFileSync(`${dbPath}-wal`, "wal-bytes");

    const now = new Date("2026-10-25T10:00:00.000Z");
    const moved = migrateLegacyData({
      dataRoot: root,
      legacyDbPath: dbPath,
      ownerEmail: "Owner@Example.com",
      now,
    });

    const ownerId = userIdFromEmail("owner@example.com");
    const ownerDir = path.join(root, "users", ownerId);
    expect(moved.status).toBe("moved");
    expect(moved.ownerUserId).toBe(ownerId);
    expect(fs.existsSync(dbPath)).toBe(false);
    expect(fs.existsSync(path.join(ownerDir, "nwtracker.db"))).toBe(true);
    expect(fs.existsSync(path.join(ownerDir, "nwtracker.db-wal"))).toBe(true);
    expect(fs.readFileSync(path.join(ownerDir, "files", "statement", "note.txt"), "utf8")).toBe("kept");
    expect(fs.readFileSync(path.join(ownerDir, "profile", "avatar"), "utf8")).toBe("face");
    expect(fs.existsSync(path.join(ownerDir, "strava-oauth.json"))).toBe(true);
    expect(fs.readFileSync(path.join(ownerDir, "email"), "utf8").trim()).toBe("owner@example.com");

    const backup = moved.backupDir!;
    expect(fs.existsSync(path.join(backup, "nwtracker.db"))).toBe(true);
    expect(fs.existsSync(path.join(backup, "nwtracker.db-wal"))).toBe(true);
    expect(fs.existsSync(path.join(backup, "files", "statement", "note.txt"))).toBe(true);

    const ownerDb = openDatabase(path.join(ownerDir, "nwtracker.db"));
    const [row] = ownerDb.select().from(accounts).where(eq(accounts.id, accountId)).all();
    expect(row?.name).toBe("Current account");
    closeDatabase(path.join(ownerDir, "nwtracker.db"));

    const dadPath = path.join(root, "users", userIdFromEmail("dad@example.com"), "nwtracker.db");
    const dadDb = openDatabase(dadPath);
    expect(dadDb.select().from(accounts).all()).toEqual([]);
    closeDatabase(dadPath);

    fs.writeFileSync(dbPath, "later");
    const again = migrateLegacyData({
      dataRoot: root,
      legacyDbPath: dbPath,
      ownerEmail: "owner@example.com",
      now: new Date("2026-10-26T10:00:00.000Z"),
    });
    expect(again.status).toBe("already-complete");
    expect(fs.readdirSync(path.join(root, "backups"))).toHaveLength(1);
    expect(fs.readFileSync(dbPath, "utf8")).toBe("later");
  });

  it("does nothing without an owner and refuses to overwrite an occupied owner database", () => {
    const root = tempRoot();
    const dbPath = legacyDb(root);
    fs.writeFileSync(dbPath, "legacy");
    expect(
      migrateLegacyData({ dataRoot: root, legacyDbPath: dbPath, ownerEmail: null }).status
    ).toBe("skipped-no-owner");
    expect(fs.existsSync(path.join(root, "users", ".migration-complete"))).toBe(false);
    expect(fs.readFileSync(dbPath, "utf8")).toBe("legacy");

    const occupied = tempRoot();
    const occupiedLegacy = legacyDb(occupied);
    insertAccount(occupiedLegacy, "Legacy");
    const ownerDir = path.join(occupied, "users", userIdFromEmail("owner@example.com"));
    fs.mkdirSync(ownerDir, { recursive: true });
    insertAccount(path.join(ownerDir, "nwtracker.db"), "Already here");

    const conflict = migrateLegacyData({
      dataRoot: occupied,
      legacyDbPath: occupiedLegacy,
      ownerEmail: "owner@example.com",
    });
    expect(conflict.status).toBe("conflict");
    expect(fs.existsSync(occupiedLegacy)).toBe(true);
    expect(fs.existsSync(path.join(occupied, "users", ".migration-complete"))).toBe(false);
  });

  it("replaces an empty owner database created before the move", () => {
    const root = tempRoot();
    const dbPath = legacyDb(root);
    const accountId = insertAccount(dbPath, "Real history");
    const ownerDb = path.join(root, "users", userIdFromEmail("owner@example.com"), "nwtracker.db");
    fs.mkdirSync(path.dirname(ownerDb), { recursive: true });
    openDatabase(ownerDb);
    closeDatabase(ownerDb);

    const result = migrateLegacyData({
      dataRoot: root,
      legacyDbPath: dbPath,
      ownerEmail: "owner@example.com",
    });
    expect(result.status).toBe("moved");
    const moved = openDatabase(ownerDb);
    const [row] = moved.select().from(accounts).where(eq(accounts.id, accountId)).all();
    expect(row?.name).toBe("Real history");
    closeDatabase(ownerDb);
  });
});

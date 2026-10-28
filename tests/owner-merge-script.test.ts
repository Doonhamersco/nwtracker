import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@/db/schema";
import { accounts } from "@/db/schema";
import { userIdFromEmail } from "@/lib/users/identity";
import { resolveOwnerDatabaseFile } from "@/lib/users/owner-db";
import { parseMergeArgs } from "../db/merge-accounts";

const previous = {
  DATA_DIR: process.env.DATA_DIR,
  ALLOWED_EMAIL: process.env.ALLOWED_EMAIL,
  ALLOWED_EMAILS: process.env.ALLOWED_EMAILS,
};

let root = "";

function restore(name: keyof typeof previous) {
  const value = previous[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restore("DATA_DIR");
  restore("ALLOWED_EMAIL");
  restore("ALLOWED_EMAILS");
  if (root) fs.rmSync(root, { recursive: true, force: true });
  root = "";
});

function ownerFile(email: string): string {
  return path.join(root, "users", userIdFromEmail(email), "nwtracker.db");
}

describe("resolveOwnerDatabaseFile", () => {
  it("opens only the owner file under DATA_DIR/users", () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "merge-owner-"));
    process.env.DATA_DIR = root;
    process.env.ALLOWED_EMAIL = "owner@example.com";
    delete process.env.ALLOWED_EMAILS;

    const dbPath = ownerFile("owner@example.com");
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, "");
    const other = ownerFile("dad@example.com");
    fs.mkdirSync(path.dirname(other), { recursive: true });
    fs.writeFileSync(other, "other");

    expect(resolveOwnerDatabaseFile()).toBe(fs.realpathSync(dbPath));
    expect(resolveOwnerDatabaseFile()).not.toBe(fs.realpathSync(other));
  });

  it("refuses a symlink that leaves the owner directory", () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "merge-owner-"));
    process.env.DATA_DIR = root;
    process.env.ALLOWED_EMAIL = "owner@example.com";
    delete process.env.ALLOWED_EMAILS;

    const outside = path.join(root, "outside.db");
    fs.writeFileSync(outside, "");
    const dbPath = ownerFile("owner@example.com");
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.symlinkSync(outside, dbPath);

    expect(() => resolveOwnerDatabaseFile()).toThrow(/outside the owner directory/);
  });
});

describe("merge-accounts command", () => {
  it("parses the dry-run flag and the default Chase account names", () => {
    expect(parseMergeArgs(["--dry-run"])).toEqual({
      dryRun: true,
      sourceName: "Chase Bank Account",
      targetName: "Chase UK",
    });
    expect(parseMergeArgs([])).toMatchObject({ dryRun: false });
  });

  it("prints a dry run against the owner database and leaves it unchanged", () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "merge-owner-"));
    const email = "owner@example.com";
    const dbPath = ownerFile(email);
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const sqlite = new Database(dbPath);
    const database = drizzle(sqlite, { schema });
    migrate(database, { migrationsFolder: path.join(process.cwd(), "db", "migrations") });
    const target = "11111111-1111-4111-8111-111111111111";
    const source = "22222222-2222-4222-8222-222222222222";
    database.insert(accounts).values([
      {
        id: target,
        name: "Chase UK",
        type: "ASSET",
        category: "CASH",
        currencyCode: "GBP",
        wrapper: "NONE",
        isActive: true,
        sortOrder: 0,
      },
      {
        id: source,
        name: "Chase Bank Account",
        type: "ASSET",
        category: "CASH",
        currencyCode: "GBP",
        wrapper: "NONE",
        isActive: true,
        sortOrder: 1,
      },
    ]).run();
    sqlite.close();

    const result = spawnSync(
      process.execPath,
      [path.join(process.cwd(), "node_modules/tsx/dist/cli.mjs"), "db/merge-accounts.ts", "--dry-run"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          DATA_DIR: root,
          ALLOWED_EMAIL: email,
          ALLOWED_EMAILS: "",
          VITEST: "",
        },
        encoding: "utf8",
      }
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Dry run: no changes written.");
    expect(result.stdout).toContain(`Owner database: ${fs.realpathSync(dbPath)}`);
    expect(result.stdout).toContain("Source: Chase Bank Account");
    expect(result.stdout).toContain("Target: Chase UK");
    expect(result.stdout).toContain("Source account kept.");

    const check = new Database(dbPath, { readonly: true, fileMustExist: true });
    const names = check.prepare("SELECT name FROM accounts ORDER BY name").all() as { name: string }[];
    check.close();
    expect(names.map((row) => row.name)).toEqual(["Chase Bank Account", "Chase UK"]);

    const applied = spawnSync(
      process.execPath,
      [path.join(process.cwd(), "node_modules/tsx/dist/cli.mjs"), "db/merge-accounts.ts"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          DATA_DIR: root,
          ALLOWED_EMAIL: email,
          ALLOWED_EMAILS: "",
          VITEST: "",
        },
        encoding: "utf8",
      }
    );
    expect(applied.status).toBe(0);
    expect(applied.stdout).toContain("Merge applied.");
    expect(applied.stdout).toContain("Source account deleted.");
    const after = new Database(dbPath, { readonly: true, fileMustExist: true });
    const remaining = after.prepare("SELECT name FROM accounts").all() as { name: string }[];
    after.close();
    expect(remaining.map((row) => row.name)).toEqual(["Chase UK"]);
  });
});

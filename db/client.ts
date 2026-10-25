import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "fs";
import path from "path";
import * as schema from "./schema";
import { seedBuiltins } from "./seed";
import { activeDataDir, currentScope } from "@/lib/users/context";
import { ensureUserMarker } from "@/lib/users/marker";
import { legacyDbPath } from "@/lib/users/paths";

type DB = BetterSQLite3Database<typeof schema>;

const MIGRATIONS_FOLDER = path.join(process.cwd(), "db", "migrations");

const connections = new Map<string, { sqlite: Database.Database; db: DB }>();

function openHandle(dbPath: string, logSeed: boolean): DB {
  const key = path.resolve(dbPath);
  const cached = connections.get(key);
  if (cached) return cached.db;

  fs.mkdirSync(path.dirname(key), { recursive: true });
  const sqlite = new Database(key);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const handle = drizzle(sqlite, { schema });
  migrate(handle, { migrationsFolder: MIGRATIONS_FOLDER });
  seedBuiltins(handle, logSeed);
  connections.set(key, { sqlite, db: handle });
  return handle;
}

export function openDatabase(dbPath: string, options?: { logSeed?: boolean }): DB {
  return openHandle(dbPath, options?.logSeed ?? false);
}

export function closeDatabase(dbPath: string): void {
  const key = path.resolve(dbPath);
  const hit = connections.get(key);
  if (!hit) return;
  try {
    hit.sqlite.pragma("wal_checkpoint(TRUNCATE)");
  } catch {
    // The file may already be closing.
  }
  hit.sqlite.close();
  connections.delete(key);
}

export function closeAllDatabases(): void {
  for (const dbPath of [...connections.keys()]) closeDatabase(dbPath);
}

function databasePath(): string {
  const scope = currentScope();
  if (scope) {
    ensureUserMarker(scope);
    return path.join(activeDataDir(), "nwtracker.db");
  }
  return legacyDbPath();
}

function activeDatabase(): DB {
  return openHandle(databasePath(), false);
}

export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const real = activeDatabase();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export type { DB };

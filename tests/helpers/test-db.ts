/**
 * Creates an isolated in-memory SQLite database for tests.
 * Each call returns a fresh database with all migrations applied.
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@/db/schema";
import path from "path";

export function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });

  migrate(db, {
    migrationsFolder: path.join(process.cwd(), "db", "migrations"),
  });

  return { db, sqlite };
}

/**
 * Wipes all rows from every table in insertion-safe reverse order.
 * Call this in beforeEach to guarantee test isolation when tests share a DB instance.
 */
export function resetAllTables(sqlite: Database.Database) {
  // Disable FK checks temporarily so we can truncate in any order
  sqlite.pragma("foreign_keys = OFF");
  const tables = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '__drizzle%'")
    .all() as { name: string }[];
  for (const { name } of tables) {
    sqlite.prepare(`DELETE FROM "${name}"`).run();
  }
  sqlite.pragma("foreign_keys = ON");
}

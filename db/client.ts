import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "nwtracker.db");

// Ensure the data directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const sqlite = new Database(DB_PATH);

// WAL mode: better read concurrency, safer crash recovery
sqlite.pragma("journal_mode = WAL");
// Enforce foreign key constraints — SQLite disables these by default
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

export type DB = typeof db;

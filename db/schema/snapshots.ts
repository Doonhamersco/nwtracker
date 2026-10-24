import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const snapshots = sqliteTable("snapshots", {
  id: text("id").primaryKey(),
  takenAt: text("taken_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  notes: text("notes"),
  // true = user submitted without completing all accounts
  isPartial: integer("is_partial", { mode: "boolean" }).notNull().default(false),
  // Materialised for chart performance — computed at commit, never updated
  netWorthGbp: real("net_worth_gbp"),
  // Portion of net_worth_gbp that came from physical assets at commit time.
  // Null on snapshots taken before physical assets existed.
  physicalAssetsGbp: real("physical_assets_gbp"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

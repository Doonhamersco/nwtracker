import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const notableEvents = sqliteTable("notable_events", {
  id: text("id").primaryKey(),
  date: text("date").notNull(), // ISO date string YYYY-MM-DD
  emoji: text("emoji").notNull(),
  label: text("label").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

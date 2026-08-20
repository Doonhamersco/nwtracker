import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const videoDiaries = sqliteTable("video_diaries", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  recordedAt: text("recorded_at").notNull(), // ISO date string YYYY-MM-DD
  youtubeVideoId: text("youtube_video_id").notNull(),
  notes: text("notes"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

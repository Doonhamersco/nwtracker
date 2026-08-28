import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const USER_SETTINGS_ID = "default";

export const userSettings = sqliteTable("user_settings", {
  id: text("id").primaryKey(),
  accentColor: text("accent_color").notNull().default("#c5a059"),
  avatarMimeType: text("avatar_mime_type"),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

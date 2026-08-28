import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const fileLinkTypeEnum = [
  "ACCOUNT",
  "SNAPSHOT",
  "GOAL",
  "SUBSCRIPTION",
] as const;

export const files = sqliteTable("files", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  // Relative path under /data/files/ on the server
  storagePath: text("storage_path").notNull().unique(),
  linkedToType: text("linked_to_type", { enum: fileLinkTypeEnum }).notNull(),
  linkedToId: text("linked_to_id").notNull(),
  uploadedAt: text("uploaded_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

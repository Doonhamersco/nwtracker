import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const videoDiaries = sqliteTable("video_diaries", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  recordedAt: text("recorded_at").notNull(), // ISO date string YYYY-MM-DD
  notes: text("notes"),
  youtubeVideoId: text("youtube_video_id").notNull(),
  // Encrypted ciphertext on R2. Empty youtubeVideoId means R2-only.
  r2ObjectKey: text("r2_object_key"),
  thumbObjectKey: text("thumb_object_key"),
  wrappedFileKey: text("wrapped_file_key"),
  wrapIv: text("wrap_iv"),
  chunkSize: integer("chunk_size"),
  ciphertextBytes: integer("ciphertext_bytes"),
  mimeType: text("mime_type"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

/** Singleton row: KDF salt + passphrase verifier. No keys. */
export const diaryCrypto = sqliteTable("diary_crypto", {
  id: text("id").primaryKey(),
  kdfSalt: text("kdf_salt").notNull(),
  verifierIv: text("verifier_iv").notNull(),
  verifierCt: text("verifier_ct").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

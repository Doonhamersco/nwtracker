CREATE TABLE `diary_crypto` (
	`id` text PRIMARY KEY NOT NULL,
	`kdf_salt` text NOT NULL,
	`verifier_iv` text NOT NULL,
	`verifier_ct` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `video_diaries` ADD `r2_object_key` text;--> statement-breakpoint
ALTER TABLE `video_diaries` ADD `thumb_object_key` text;--> statement-breakpoint
ALTER TABLE `video_diaries` ADD `wrapped_file_key` text;--> statement-breakpoint
ALTER TABLE `video_diaries` ADD `wrap_iv` text;--> statement-breakpoint
ALTER TABLE `video_diaries` ADD `chunk_size` integer;--> statement-breakpoint
ALTER TABLE `video_diaries` ADD `ciphertext_bytes` integer;--> statement-breakpoint
ALTER TABLE `video_diaries` ADD `mime_type` text;
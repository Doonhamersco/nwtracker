CREATE TABLE `user_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`accent_color` text DEFAULT '#c5a059' NOT NULL,
	`avatar_mime_type` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);

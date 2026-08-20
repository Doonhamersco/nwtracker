CREATE TABLE `video_diaries` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`recorded_at` text NOT NULL,
	`youtube_video_id` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE `notable_events` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`emoji` text NOT NULL,
	`label` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);

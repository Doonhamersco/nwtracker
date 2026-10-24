CREATE TABLE `physical_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`value_gbp` real NOT NULL,
	`purchase_date` text,
	`purchase_price_gbp` real,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `snapshots` ADD `physical_assets_gbp` real;
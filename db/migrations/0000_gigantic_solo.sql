CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`category` text NOT NULL,
	`currency_code` text DEFAULT 'GBP' NOT NULL,
	`institution` text,
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`taken_at` text DEFAULT (datetime('now')) NOT NULL,
	`notes` text,
	`is_partial` integer DEFAULT false NOT NULL,
	`net_worth_gbp` real,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `account_valuations` (
	`id` text PRIMARY KEY NOT NULL,
	`snapshot_id` text NOT NULL,
	`account_id` text NOT NULL,
	`value_native` real NOT NULL,
	`value_gbp` real NOT NULL,
	`is_carried_forward` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `snapshots`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_valuation_snapshot_account` ON `account_valuations` (`snapshot_id`,`account_id`);--> statement-breakpoint
CREATE TABLE `fx_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`snapshot_id` text NOT NULL,
	`from_currency` text NOT NULL,
	`to_currency` text DEFAULT 'GBP' NOT NULL,
	`rate` real NOT NULL,
	`source` text NOT NULL,
	`fetched_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `snapshots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_fx_snapshot_pair` ON `fx_rates` (`snapshot_id`,`from_currency`,`to_currency`);--> statement-breakpoint
CREATE TABLE `hevy_sync_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`snapshot_id` text NOT NULL,
	`synced_at` text DEFAULT (datetime('now')) NOT NULL,
	`workouts_last_30d` integer,
	`total_volume_kg` real,
	`personal_records_count` integer,
	`raw_json` text,
	FOREIGN KEY (`snapshot_id`) REFERENCES `snapshots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `life_metric_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`unit` text NOT NULL,
	`display_color` text DEFAULT '#6366f1' NOT NULL,
	`is_builtin` integer DEFAULT false NOT NULL,
	`is_hevy_metric` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `life_metric_readings` (
	`id` text PRIMARY KEY NOT NULL,
	`snapshot_id` text NOT NULL,
	`metric_id` text NOT NULL,
	`value` real NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `snapshots`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`metric_id`) REFERENCES `life_metric_definitions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_reading_snapshot_metric` ON `life_metric_readings` (`snapshot_id`,`metric_id`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`target_value` real NOT NULL,
	`target_date` text NOT NULL,
	`metric_type` text NOT NULL,
	`linked_metric_id` text,
	`linked_category` text,
	`baseline_value` real,
	`baseline_date` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`linked_metric_id`) REFERENCES `life_metric_definitions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`storage_path` text NOT NULL,
	`linked_to_type` text NOT NULL,
	`linked_to_id` text NOT NULL,
	`uploaded_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `files_storage_path_unique` ON `files` (`storage_path`);
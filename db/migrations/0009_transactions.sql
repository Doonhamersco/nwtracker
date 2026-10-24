CREATE TABLE `transaction_category_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`pattern` text NOT NULL,
	`match_type` text NOT NULL,
	`category` text NOT NULL,
	`is_transfer` integer DEFAULT false NOT NULL,
	`priority` integer DEFAULT 100 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`date` text NOT NULL,
	`description_raw` text NOT NULL,
	`merchant` text NOT NULL,
	`amount_gbp` real NOT NULL,
	`direction` text NOT NULL,
	`type` text NOT NULL,
	`balance_after_gbp` real NOT NULL,
	`category` text,
	`category_source` text,
	`is_transfer` integer DEFAULT false NOT NULL,
	`subscription_id` text,
	`statement_month` text NOT NULL,
	`import_batch_id` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `transactions_account_date_idx` ON `transactions` (`account_id`,`date`);--> statement-breakpoint
CREATE INDEX `transactions_category_idx` ON `transactions` (`category`);
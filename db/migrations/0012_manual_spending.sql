CREATE TABLE `manual_spending_totals` (
	`id` text PRIMARY KEY NOT NULL,
	`month` text NOT NULL,
	`category` text NOT NULL,
	`amount_gbp` real NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_manual_spending_month_category` ON `manual_spending_totals` (`month`,`category`);
--> statement-breakpoint
CREATE TABLE `manual_spending_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`category` text NOT NULL,
	`amount_gbp` real NOT NULL,
	`note` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `manual_spending_lines_date_idx` ON `manual_spending_lines` (`date`);

CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`cost_gbp` real NOT NULL,
	`billing_cycle` text NOT NULL,
	`next_renewal_date` text,
	`category` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`cancelled_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);

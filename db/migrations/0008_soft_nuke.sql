CREATE TABLE `career_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`start_date` text NOT NULL,
	`date_of_birth` text NOT NULL,
	`npa` integer DEFAULT 60 NOT NULL,
	`sipp_access_age` integer DEFAULT 57 NOT NULL,
	`police_contribution_rate` real DEFAULT 0.1344 NOT NULL,
	`accrual_divisor` real DEFAULT 55.3 NOT NULL,
	`scottish_higher_rate_threshold` real DEFAULT 43663 NOT NULL,
	`isa_monthly_gbp` real DEFAULT 300 NOT NULL,
	`expected_real_return` real DEFAULT 0.07 NOT NULL,
	`commutation_factor` real DEFAULT 12 NOT NULL,
	`commute_fraction` real DEFAULT 0.25 NOT NULL,
	`pay_scale_json` text NOT NULL,
	`projection_years` integer DEFAULT 30 NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `accounts` ADD `wrapper` text DEFAULT 'NONE' NOT NULL;
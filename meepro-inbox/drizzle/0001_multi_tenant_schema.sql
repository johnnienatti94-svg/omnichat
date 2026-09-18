-- Migration 0001: Multi-tenant organization schema & expanded case/message tracking

ALTER TABLE `conversations` ADD COLUMN `priority` text DEFAULT 'normal' NOT NULL;
--> statement-breakpoint
ALTER TABLE `conversations` ADD COLUMN `issue_type` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `conversations` ADD COLUMN `resolution` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `conversations` ADD COLUMN `sales_amount` real DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `conversations` ADD COLUMN `sales_successful` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `conversations` ADD COLUMN `closed_at` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `conversations` ADD COLUMN `closed_by` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `conversations` ADD COLUMN `customer_id` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `messages` ADD COLUMN `attachments` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `messages` ADD COLUMN `external_id` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `messages` ADD COLUMN `delivery_status` text DEFAULT 'delivered' NOT NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL UNIQUE,
	`created_at` text NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `users` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'agent' NOT NULL,
	`channel_access` text DEFAULT 'all' NOT NULL,
	`working_hours` text DEFAULT '{"enabled":false,"start":"09:00","end":"18:00","days":[1,2,3,4,5]}' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_users_org` ON `users` (`org_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_users_org_email` ON `users` (`org_id`, `email`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`leader_id` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_teams_org` ON `teams` (`org_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `team_members` (
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`joined_at` text NOT NULL,
	PRIMARY KEY(`team_id`, `user_id`),
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `channel_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`channel` text NOT NULL,
	`name` text NOT NULL,
	`account_id` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'demo' NOT NULL,
	`credentials_encrypted` text DEFAULT '' NOT NULL,
	`webhook_secret` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_channel_conn_org` ON `channel_connections` (`org_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_customers_org` ON `customers` (`org_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `customer_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`channel` text NOT NULL,
	`external_id` text NOT NULL,
	`handle` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`),
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_identities_customer` ON `customer_identities` (`customer_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_identities_channel_external` ON `customer_identities` (`org_id`, `channel`, `external_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`details` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_audit_logs_org` ON `audit_logs` (`org_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_audit_logs_created` ON `audit_logs` (`created_at`);

CREATE TABLE `conversations` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`channel` text NOT NULL,
	`handle` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`assignee` text DEFAULT '' NOT NULL,
	`tag` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
CREATE INDEX `idx_conversations_owner_status` ON `conversations` (`owner`,`status`);--> statement-breakpoint
CREATE TABLE `initialized` (
	`owner` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`body` text NOT NULL,
	`direction` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
CREATE INDEX `idx_messages_owner_conversation` ON `messages` (`owner`,`conversation_id`);--> statement-breakpoint
CREATE TABLE `replies` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
CREATE TABLE `channel_setup` (
	`owner` text NOT NULL,
	`channel` text NOT NULL,
	`account` text NOT NULL,
	`url` text NOT NULL,
	PRIMARY KEY(`owner`, `channel`)
);

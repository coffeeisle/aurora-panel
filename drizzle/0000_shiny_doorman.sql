CREATE TABLE `nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`host` text NOT NULL,
	`port` integer DEFAULT 8443 NOT NULL,
	`token` text NOT NULL,
	`status` text DEFAULT 'connecting' NOT NULL,
	`last_ping_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `servers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`owner_id` text NOT NULL,
	`node_id` text NOT NULL,
	`type` text NOT NULL,
	`game` text NOT NULL,
	`status` text DEFAULT 'installing' NOT NULL,
	`process_type` text DEFAULT 'docker' NOT NULL,
	`docker_image` text,
	`startup_command` text NOT NULL,
	`stop_command` text DEFAULT 'stop' NOT NULL,
	`allocated_memory` integer DEFAULT 1024 NOT NULL,
	`allocated_cpus` text,
	`allocated_disk` integer DEFAULT 10240 NOT NULL,
	`allocation_port` integer NOT NULL,
	`allocation_ip` text DEFAULT '0.0.0.0' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `servers_slug_unique` ON `servers` (`slug`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
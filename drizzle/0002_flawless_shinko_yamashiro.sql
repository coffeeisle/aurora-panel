ALTER TABLE `servers` ADD `game_version` text DEFAULT 'latest' NOT NULL;--> statement-breakpoint
ALTER TABLE `servers` ADD `loader` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `servers` ADD `platform` text DEFAULT '' NOT NULL;
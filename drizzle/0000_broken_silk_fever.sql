CREATE TABLE `discord_sync_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`minecraft_uuid` varchar(36) NOT NULL,
	`minecraft_name` varchar(16) NOT NULL,
	`discord_id` varchar(20),
	`sync_code` varchar(10),
	`is_synced` boolean NOT NULL DEFAULT false,
	`sync_date` timestamp,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `discord_sync_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `discord_sync_users_minecraft_uuid_unique` UNIQUE(`minecraft_uuid`),
	CONSTRAINT `discord_sync_users_discord_id_unique` UNIQUE(`discord_id`)
);

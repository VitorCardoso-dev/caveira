CREATE TABLE `point_activities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sourceType` varchar(32) NOT NULL,
	`sourceId` int NOT NULL,
	`occurrenceDate` date NOT NULL,
	`category` varchar(80) NOT NULL,
	`basePoints` int NOT NULL,
	`isCorrosive` boolean NOT NULL DEFAULT false,
	`status` enum('completed','missed') NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `point_activities_id` PRIMARY KEY(`id`),
	CONSTRAINT `point_activities_identity_uq` UNIQUE(`userId`,`sourceType`,`sourceId`,`occurrenceDate`)
);
--> statement-breakpoint
ALTER TABLE `habits` ADD `isCorrosive` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `point_transactions` ADD `activityId` int;--> statement-breakpoint
ALTER TABLE `point_transactions` ADD `category` varchar(80) DEFAULT 'Outros' NOT NULL;--> statement-breakpoint
ALTER TABLE `point_transactions` ADD `movementType` enum('legacy','earned','missed','corrosive_missed','redemption','adjustment') DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `point_transactions` ADD `sourceType` varchar(32);--> statement-breakpoint
ALTER TABLE `point_transactions` ADD `sourceId` int;--> statement-breakpoint
ALTER TABLE `point_transactions` ADD `occurrenceDate` date;--> statement-breakpoint
ALTER TABLE `point_transactions` ADD `idempotencyKey` varchar(180);--> statement-breakpoint
ALTER TABLE `tasks` ADD `isCorrosive` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `point_transactions` ADD CONSTRAINT `point_transactions_user_idempotency_uq` UNIQUE(`userId`,`idempotencyKey`);--> statement-breakpoint
ALTER TABLE `point_activities` ADD CONSTRAINT `point_activities_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `point_transactions` ADD CONSTRAINT `point_transactions_activityId_point_activities_id_fk` FOREIGN KEY (`activityId`) REFERENCES `point_activities`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `point_transactions_user_date_idx` ON `point_transactions` (`userId`,`occurrenceDate`);
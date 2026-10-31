CREATE TABLE `goal_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`goalId` int NOT NULL,
	`sourceType` varchar(24) NOT NULL,
	`sourceId` int,
	`weightPercent` int NOT NULL DEFAULT 100,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `goal_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `goal_sources` ADD CONSTRAINT `goal_sources_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `goal_sources` ADD CONSTRAINT `goal_sources_goalId_goals_id_fk` FOREIGN KEY (`goalId`) REFERENCES `goals`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `goal_sources_goal_idx` ON `goal_sources` (`goalId`);
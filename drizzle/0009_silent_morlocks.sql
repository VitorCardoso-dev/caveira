ALTER TABLE `tasks` DROP FOREIGN KEY `tasks_goalId_goals_id_fk`;
--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_goalId_goals_id_fk` FOREIGN KEY (`goalId`) REFERENCES `goals`(`id`) ON DELETE set null ON UPDATE no action;
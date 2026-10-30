ALTER TABLE `tasks` ADD CONSTRAINT `tasks_goalId_goals_id_fk` FOREIGN KEY (`goalId`) REFERENCES `goals`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `training_exercises` ADD CONSTRAINT `training_exercises_libraryId_exercise_library_id_fk` FOREIGN KEY (`libraryId`) REFERENCES `exercise_library`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `tasks_user_dueDate_idx` ON `tasks` (`userId`,`dueDate`);--> statement-breakpoint
CREATE INDEX `tasks_goalId_idx` ON `tasks` (`goalId`);
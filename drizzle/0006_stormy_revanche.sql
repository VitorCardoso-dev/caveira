CREATE TABLE `exercise_library` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`muscleGroup` varchar(80) NOT NULL,
	`description` text,
	`equipment` varchar(120),
	`demonstrationUrl` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `exercise_library_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `training_exercises` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`planId` int NOT NULL,
	`libraryId` int,
	`name` varchar(160) NOT NULL,
	`muscleGroup` varchar(80) NOT NULL,
	`equipment` varchar(120),
	`description` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`plannedSets` int NOT NULL DEFAULT 3,
	`plannedReps` int NOT NULL DEFAULT 10,
	`plannedWeightKg` int NOT NULL DEFAULT 0,
	`restSeconds` int NOT NULL DEFAULT 90,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `training_exercises_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `training_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`category` varchar(80) NOT NULL DEFAULT 'Musculação',
	`modality` varchar(40) NOT NULL DEFAULT 'musculacao',
	`weekdays` varchar(80) NOT NULL DEFAULT '',
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `training_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `training_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`planId` int NOT NULL,
	`sessionDate` date NOT NULL,
	`startedAt` timestamp NOT NULL,
	`endedAt` timestamp,
	`status` varchar(24) NOT NULL DEFAULT 'in_progress',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `training_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `training_sets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sessionId` int NOT NULL,
	`exerciseId` int NOT NULL,
	`setNumber` int NOT NULL,
	`plannedReps` int NOT NULL,
	`plannedWeightKg` int NOT NULL DEFAULT 0,
	`actualReps` int NOT NULL DEFAULT 0,
	`actualWeightKg` int NOT NULL DEFAULT 0,
	`completed` boolean NOT NULL DEFAULT false,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `training_sets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `exercise_library` ADD CONSTRAINT `exercise_library_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `training_exercises` ADD CONSTRAINT `training_exercises_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `training_exercises` ADD CONSTRAINT `training_exercises_planId_training_plans_id_fk` FOREIGN KEY (`planId`) REFERENCES `training_plans`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `training_plans` ADD CONSTRAINT `training_plans_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `training_sessions` ADD CONSTRAINT `training_sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `training_sessions` ADD CONSTRAINT `training_sessions_planId_training_plans_id_fk` FOREIGN KEY (`planId`) REFERENCES `training_plans`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `training_sets` ADD CONSTRAINT `training_sets_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `training_sets` ADD CONSTRAINT `training_sets_sessionId_training_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `training_sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `training_sets` ADD CONSTRAINT `training_sets_exerciseId_training_exercises_id_fk` FOREIGN KEY (`exerciseId`) REFERENCES `training_exercises`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `goals` ADD `automationType` varchar(24) DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `goals` ADD `automationRefId` int;--> statement-breakpoint
ALTER TABLE `goals` ADD `automationStartDate` date;
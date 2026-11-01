CREATE TABLE `backup_imports` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `exportId` varchar(64) NOT NULL,
  `importedAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `backup_imports_id` PRIMARY KEY(`id`),
  CONSTRAINT `backup_imports_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action,
  CONSTRAINT `backup_imports_user_export_uq` UNIQUE(`userId`,`exportId`)
);

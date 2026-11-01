ALTER TABLE `tasks` ADD `completedAt` timestamp NULL;

UPDATE `tasks`
SET `completedAt` = `updatedAt`
WHERE `status` = 'completed' AND `completedAt` IS NULL;

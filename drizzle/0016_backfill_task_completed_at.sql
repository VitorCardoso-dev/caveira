UPDATE `tasks` SET `completedAt` = `updatedAt` WHERE `status` = 'completed' AND `completedAt` IS NULL;

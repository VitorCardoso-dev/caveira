CREATE INDEX `habits_user_active_idx` ON `habits` (`userId`, `active`);
--> statement-breakpoint
CREATE INDEX `goals_user_status_idx` ON `goals` (`userId`, `status`);
--> statement-breakpoint
CREATE INDEX `focus_sessions_user_created_idx` ON `focus_sessions` (`userId`, `createdAt`);
--> statement-breakpoint
CREATE INDEX `module_records_user_module_date_idx` ON `module_records` (`userId`, `module`, `recordDate`);
--> statement-breakpoint
CREATE INDEX `audit_logs_user_created_idx` ON `audit_logs` (`userId`, `createdAt`);
--> statement-breakpoint
CREATE INDEX `rewards_user_status_idx` ON `rewards` (`userId`, `status`);
--> statement-breakpoint
CREATE INDEX `reward_redemptions_user_redeemed_idx` ON `reward_redemptions` (`userId`, `redeemedAt`);
--> statement-breakpoint
CREATE INDEX `training_plans_user_active_idx` ON `training_plans` (`userId`, `active`);
--> statement-breakpoint
CREATE INDEX `training_exercises_plan_order_idx` ON `training_exercises` (`userId`, `planId`, `sortOrder`);
--> statement-breakpoint
CREATE INDEX `training_sessions_user_status_date_idx` ON `training_sessions` (`userId`, `status`, `sessionDate`);

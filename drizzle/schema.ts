import {
  boolean,
  date,
  int,
  mysqlEnum,
  mysqlTable,
  index,
  uniqueIndex,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const habits = mysqlTable("habits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  name: varchar("name", { length: 160 }).notNull(),
  category: varchar("category", { length: 80 }).default("Disciplina").notNull(),
  isCorrosive: boolean("isCorrosive").default(false).notNull(),
  frequency: mysqlEnum("frequency", ["daily", "weekly", "custom"]).default("daily").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const habitCompletions = mysqlTable("habit_completions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  habitId: int("habitId").notNull().references(() => habits.id),
  day: date("day").notNull(),
  status: mysqlEnum("status", ["completed", "dismissed", "missed"]).default("completed").notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  uniqueHabitDay: uniqueIndex("habit_completions_user_habit_day_uq").on(table.userId, table.habitId, table.day),
}));

export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 80 }).default("Geral").notNull(),
  isCorrosive: boolean("isCorrosive").default(false).notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high"]).default("medium").notNull(),
  status: mysqlEnum("status", ["todo", "in_progress", "completed"]).default("todo").notNull(),
  dueDate: date("dueDate"),
  goalId: int("goalId").references(() => goals.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  userDueDateIdx: index("tasks_user_dueDate_idx").on(table.userId, table.dueDate),
  goalIdx: index("tasks_goalId_idx").on(table.goalId),
}));

export const goals = mysqlTable("goals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  title: varchar("title", { length: 200 }).notNull(),
  category: varchar("category", { length: 80 }).default("Pessoal").notNull(),
  progress: int("progress").default(0).notNull(),
  target: int("target").default(100).notNull(),
  deadline: date("deadline"),
  automationType: varchar("automationType", { length: 24 }).default("manual").notNull(),
  automationRefId: int("automationRefId"),
  automationStartDate: date("automationStartDate"),
  status: mysqlEnum("status", ["active", "completed", "paused"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const goalSources = mysqlTable("goal_sources", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  goalId: int("goalId").notNull().references(() => goals.id, { onDelete: "cascade" }),
  sourceType: varchar("sourceType", { length: 24 }).notNull(),
  sourceId: int("sourceId"),
  weightPercent: int("weightPercent").default(100).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ goalIdx: index("goal_sources_goal_idx").on(table.goalId) }));

export const focusSessions = mysqlTable("focus_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  durationMinutes: int("durationMinutes").notNull(),
  startedAt: timestamp("startedAt").notNull(),
  endedAt: timestamp("endedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const moduleRecords = mysqlTable("module_records", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  module: varchar("module", { length: 32 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  subtitle: varchar("subtitle", { length: 240 }),
  status: varchar("status", { length: 32 }).default("active").notNull(),
  numericValue: int("numericValue").default(0).notNull(),
  amountCents: int("amountCents").default(0).notNull(),
  recordDate: date("recordDate"),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  action: varchar("action", { length: 32 }).notNull(),
  entity: varchar("entity", { length: 64 }).notNull(),
  entityId: int("entityId"),
  beforeData: text("beforeData"),
  afterData: text("afterData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const userSettings = mysqlTable("user_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique().references(() => users.id),
  goals: text("goals"),
  notifications: boolean("notifications").default(true).notNull(),
  preferredFocusMinutes: int("preferredFocusMinutes").default(25).notNull(),
  preferredBreakMinutes: int("preferredBreakMinutes").default(5).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const pointActivities = mysqlTable("point_activities", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  sourceType: varchar("sourceType", { length: 32 }).notNull(),
  sourceId: int("sourceId").notNull(),
  occurrenceDate: date("occurrenceDate").notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  basePoints: int("basePoints").notNull(),
  isCorrosive: boolean("isCorrosive").default(false).notNull(),
  status: mysqlEnum("status", ["completed", "missed"]).notNull(),
  version: int("version").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  activityIdentity: uniqueIndex("point_activities_identity_uq").on(table.userId, table.sourceType, table.sourceId, table.occurrenceDate),
}));

export const pointTransactions = mysqlTable("point_transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  points: int("points").notNull(),
  reason: varchar("reason", { length: 200 }).notNull(),
  referenceId: int("referenceId"),
  activityId: int("activityId").references(() => pointActivities.id),
  category: varchar("category", { length: 80 }).default("Outros").notNull(),
  movementType: mysqlEnum("movementType", ["legacy", "earned", "missed", "corrosive_missed", "redemption", "adjustment"]).default("legacy").notNull(),
  sourceType: varchar("sourceType", { length: 32 }),
  sourceId: int("sourceId"),
  occurrenceDate: date("occurrenceDate"),
  idempotencyKey: varchar("idempotencyKey", { length: 180 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({
  ledgerDateIdx: index("point_transactions_user_date_idx").on(table.userId, table.occurrenceDate),
  idempotencyIdx: uniqueIndex("point_transactions_user_idempotency_uq").on(table.userId, table.idempotencyKey),
}));

export const rewards = mysqlTable("rewards", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  title: varchar("title", { length: 160 }).notNull(),
  description: varchar("description", { length: 500 }),
  category: varchar("category", { length: 80 }).default("Lazer").notNull(),
  imageUrl: varchar("imageUrl", { length: 1000 }),
  costPoints: int("costPoints").notNull(),
  status: mysqlEnum("status", ["active", "archived"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const rewardRedemptions = mysqlTable("reward_redemptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  rewardId: int("rewardId").notNull().references(() => rewards.id),
  costPoints: int("costPoints").notNull(),
  pointTransactionId: int("pointTransactionId").notNull().references(() => pointTransactions.id),
  redeemedAt: timestamp("redeemedAt").defaultNow().notNull(),
});

export const exerciseLibrary = mysqlTable("exercise_library", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  name: varchar("name", { length: 160 }).notNull(),
  muscleGroup: varchar("muscleGroup", { length: 80 }).notNull(),
  description: text("description"),
  equipment: varchar("equipment", { length: 120 }),
  demonstrationUrl: varchar("demonstrationUrl", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const trainingPlans = mysqlTable("training_plans", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  name: varchar("name", { length: 160 }).notNull(),
  category: varchar("category", { length: 80 }).default("Musculação").notNull(),
  modality: varchar("modality", { length: 40 }).default("musculacao").notNull(),
  weekdays: varchar("weekdays", { length: 80 }).default("").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const trainingExercises = mysqlTable("training_exercises", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  planId: int("planId").notNull().references(() => trainingPlans.id),
  libraryId: int("libraryId").references(() => exerciseLibrary.id),
  name: varchar("name", { length: 160 }).notNull(),
  muscleGroup: varchar("muscleGroup", { length: 80 }).notNull(),
  equipment: varchar("equipment", { length: 120 }),
  description: text("description"),
  sortOrder: int("sortOrder").default(0).notNull(),
  plannedSets: int("plannedSets").default(3).notNull(),
  plannedReps: int("plannedReps").default(10).notNull(),
  plannedWeightKg: int("plannedWeightKg").default(0).notNull(),
  restSeconds: int("restSeconds").default(90).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const trainingSessions = mysqlTable("training_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  planId: int("planId").notNull().references(() => trainingPlans.id),
  sessionDate: date("sessionDate").notNull(),
  startedAt: timestamp("startedAt").notNull(),
  endedAt: timestamp("endedAt"),
  status: varchar("status", { length: 24 }).default("in_progress").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const trainingSets = mysqlTable("training_sets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  sessionId: int("sessionId").notNull().references(() => trainingSessions.id),
  exerciseId: int("exerciseId").notNull().references(() => trainingExercises.id),
  setNumber: int("setNumber").notNull(),
  plannedReps: int("plannedReps").notNull(),
  plannedWeightKg: int("plannedWeightKg").default(0).notNull(),
  actualReps: int("actualReps").default(0).notNull(),
  actualWeightKg: int("actualWeightKg").default(0).notNull(),
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  uniqueSessionExerciseSet: uniqueIndex("training_sets_session_exercise_set_uq").on(table.sessionId, table.exerciseId, table.setNumber),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Habit = typeof habits.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type TrainingPlan = typeof trainingPlans.$inferSelect;
export type TrainingExercise = typeof trainingExercises.$inferSelect;
export type TrainingSession = typeof trainingSessions.$inferSelect;
export type TrainingSet = typeof trainingSets.$inferSelect;

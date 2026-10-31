import { relations } from "drizzle-orm";
import {
  auditLogs,
  exerciseLibrary,
  focusSessions,
  goals,
  habitCompletions,
  habits,
  moduleRecords,
  pointActivities,
  pointTransactions,
  tasks,
  trainingExercises,
  trainingPlans,
  trainingSessions,
  trainingSets,
  userSettings,
  users,
} from "./schema";

export const usersRelations = relations(users, ({ many, one }) => ({
  habits: many(habits),
  habitCompletions: many(habitCompletions),
  tasks: many(tasks),
  goals: many(goals),
  focusSessions: many(focusSessions),
  moduleRecords: many(moduleRecords),
  auditLogs: many(auditLogs),
  pointActivities: many(pointActivities),
  pointTransactions: many(pointTransactions),
  settings: one(userSettings),
  exerciseLibrary: many(exerciseLibrary),
  trainingPlans: many(trainingPlans),
  trainingExercises: many(trainingExercises),
  trainingSessions: many(trainingSessions),
  trainingSets: many(trainingSets),
}));

export const habitsRelations = relations(habits, ({ one, many }) => ({
  user: one(users, { fields: [habits.userId], references: [users.id] }),
  completions: many(habitCompletions),
}));

export const habitCompletionsRelations = relations(habitCompletions, ({ one }) => ({
  user: one(users, { fields: [habitCompletions.userId], references: [users.id] }),
  habit: one(habits, { fields: [habitCompletions.habitId], references: [habits.id] }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  user: one(users, { fields: [tasks.userId], references: [users.id] }),
  goal: one(goals, { fields: [tasks.goalId], references: [goals.id] }),
}));

export const goalsRelations = relations(goals, ({ one, many }) => ({
  user: one(users, { fields: [goals.userId], references: [users.id] }),
  tasks: many(tasks),
}));

export const focusSessionsRelations = relations(focusSessions, ({ one }) => ({
  user: one(users, { fields: [focusSessions.userId], references: [users.id] }),
}));

export const moduleRecordsRelations = relations(moduleRecords, ({ one }) => ({
  user: one(users, { fields: [moduleRecords.userId], references: [users.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, { fields: [userSettings.userId], references: [users.id] }),
}));

export const pointTransactionsRelations = relations(pointTransactions, ({ one }) => ({
  user: one(users, { fields: [pointTransactions.userId], references: [users.id] }),
  activity: one(pointActivities, { fields: [pointTransactions.activityId], references: [pointActivities.id] }),
}));

export const pointActivitiesRelations = relations(pointActivities, ({ one, many }) => ({
  user: one(users, { fields: [pointActivities.userId], references: [users.id] }),
  transactions: many(pointTransactions),
}));

export const exerciseLibraryRelations = relations(exerciseLibrary, ({ one, many }) => ({
  user: one(users, { fields: [exerciseLibrary.userId], references: [users.id] }),
  exercises: many(trainingExercises),
}));

export const trainingPlansRelations = relations(trainingPlans, ({ one, many }) => ({
  user: one(users, { fields: [trainingPlans.userId], references: [users.id] }),
  exercises: many(trainingExercises),
  sessions: many(trainingSessions),
}));

export const trainingExercisesRelations = relations(trainingExercises, ({ one, many }) => ({
  user: one(users, { fields: [trainingExercises.userId], references: [users.id] }),
  plan: one(trainingPlans, { fields: [trainingExercises.planId], references: [trainingPlans.id] }),
  library: one(exerciseLibrary, { fields: [trainingExercises.libraryId], references: [exerciseLibrary.id] }),
  sets: many(trainingSets),
}));

export const trainingSessionsRelations = relations(trainingSessions, ({ one, many }) => ({
  user: one(users, { fields: [trainingSessions.userId], references: [users.id] }),
  plan: one(trainingPlans, { fields: [trainingSessions.planId], references: [trainingPlans.id] }),
  sets: many(trainingSets),
}));

export const trainingSetsRelations = relations(trainingSets, ({ one }) => ({
  user: one(users, { fields: [trainingSets.userId], references: [users.id] }),
  session: one(trainingSessions, { fields: [trainingSets.sessionId], references: [trainingSessions.id] }),
  exercise: one(trainingExercises, { fields: [trainingSets.exerciseId], references: [trainingExercises.id] }),
}));

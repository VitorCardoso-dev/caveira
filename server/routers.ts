import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  auditLogs,
  focusSessions,
  goals,
  habitCompletions,
  habits,
  moduleRecords,
  pointActivities,
  pointTransactions,
  rewardRedemptions,
  rewards,
  tasks,
  exerciseLibrary,
  trainingExercises,
  trainingPlans,
  trainingSessions,
  trainingSets,
  userSettings,
} from "../drizzle/schema";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { asDate, assertBackupRelationships, backupPayloadSchema, optionalNumber, optionalString, remapPointReference, requiredNumber, requiredString, rowId } from "./backup";

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
const idSchema = z.number().int().positive();

async function requireDb() {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Banco de dados indisponível. Tente novamente em instantes.",
    });
  }
  return db;
}

function dateKey(value: Date | string) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function sortableDate(value: Date | null) {
  return value ? value.toISOString() : "9999-12-31";
}

function previousDay(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function calculateStreak(days: Set<string>, today: string) {
  let cursor = today;
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = previousDay(cursor);
  }
  return streak;
}

const POINTS = { habitDone: 2, habitMissed: -1, goalDone: 8, focusBlock: 1 } as const;
const CATEGORY_POINTS: Record<string, number> = {
  "Outros": 4,
  "Geral": 4,
  "Mente": 6,
  "Hábitos": 6,
  "Disciplina": 6,
  "Relacionamentos": 6,
  "Físico": 8,
  "Saúde": 8,
  "Estudos": 10,
  "Desenvolvimento pessoal": 10,
  "Alimentação": 12,
  "Trabalho": 14,
  "Financeiro": 14,
};
const LEGACY_CATEGORY_POINTS: Record<string, number> = { "Alimentação": 8, "Trabalho": 7, "Estudos": 6, "Financeiro": 6, "Físico": 5, "Saúde": 5, "Desenvolvimento pessoal": 5, "Hábitos": 4, "Mente": 4, "Relacionamentos": 4, "Outros": 3, "Geral": 3 };
export function pointsForCategory(category: string | null | undefined) { return CATEGORY_POINTS[category ?? "Outros"] ?? 4; }
function legacyPointsForCategory(category: string | null | undefined) { return LEGACY_CATEGORY_POINTS[category ?? "Geral"] ?? 3; }
export function missedPoints(basePoints: number, isCorrosive: boolean) { return isCorrosive ? -(basePoints * 2) : -Math.floor(basePoints / 2); }
const NEW_SCORING_START = "2026-10-30";

type Db = Awaited<ReturnType<typeof requireDb>>;
type ActivityOutcome = "completed" | "missed";

async function recordActivityOutcome(db: Db, input: { userId: number; sourceType: "habit" | "task"; sourceId: number; occurrenceDate: string; category: string; basePoints: number; isCorrosive: boolean; outcome: ActivityOutcome }) {
  return db.transaction(async tx => {
    const day = new Date(`${input.occurrenceDate}T00:00:00.000Z`);
    const existing = await tx.select().from(pointActivities).where(and(eq(pointActivities.userId, input.userId), eq(pointActivities.sourceType, input.sourceType), eq(pointActivities.sourceId, input.sourceId), eq(pointActivities.occurrenceDate, day))).limit(1);
    const current = existing[0];
    const currentPoints = current ? (current.status === "completed" ? current.basePoints : missedPoints(current.basePoints, current.isCorrosive)) : 0;
    const targetPoints = input.outcome === "completed" ? input.basePoints : missedPoints(input.basePoints, input.isCorrosive);
    if (current && current.status === input.outcome) return { created: false, transactionId: null };
    const nextVersion = (current?.version ?? 0) + 1;
    let activityId = current?.id;
    if (current) {
      await tx.update(pointActivities).set({ status: input.outcome, version: nextVersion }).where(and(eq(pointActivities.id, current.id), eq(pointActivities.userId, input.userId)));
    } else {
      const inserted = await tx.insert(pointActivities).values({ userId: input.userId, sourceType: input.sourceType, sourceId: input.sourceId, occurrenceDate: day, category: input.category, basePoints: input.basePoints, isCorrosive: input.isCorrosive, status: input.outcome, version: nextVersion });
      activityId = Number(inserted[0].insertId);
    }
    const delta = targetPoints - currentPoints;
    const movementType = !current ? (input.outcome === "completed" ? "earned" : input.isCorrosive ? "corrosive_missed" : "missed") : "adjustment";
    const reason = current ? `Ajuste de ${input.sourceType === "habit" ? "hábito" : "tarefa"}` : input.outcome === "completed" ? `${input.sourceType === "habit" ? "Hábito" : "Tarefa"} cumprido` : `${input.sourceType === "habit" ? "Hábito" : "Tarefa"} não cumprido`;
    const key = `${input.sourceType}:${input.sourceId}:${input.occurrenceDate}:v${nextVersion}`;
    const inserted = await tx.insert(pointTransactions).values({ userId: input.userId, points: delta, reason, referenceId: input.sourceId, activityId: activityId ?? null, category: input.category, movementType, sourceType: input.sourceType, sourceId: input.sourceId, occurrenceDate: day, idempotencyKey: key });
    return { created: true, transactionId: Number(inserted[0].insertId) };
  });
}

async function reconcileMissedActivities(db: Db, userId: number, today: string) {
  if (today < NEW_SCORING_START) return;
  const [habitRows, completionRows, taskRows] = await Promise.all([
    db.select().from(habits).where(eq(habits.userId, userId)),
    db.select().from(habitCompletions).where(eq(habitCompletions.userId, userId)),
    db.select().from(tasks).where(eq(tasks.userId, userId)),
  ]);
  const completionStatus = new Map(completionRows.map(row => [`${row.habitId}:${dateKey(row.day)}`, row.status]));
  for (const habit of habitRows.filter(row => row.active && row.frequency === "daily")) {
    const firstDay = dateKey(habit.createdAt) > NEW_SCORING_START ? dateKey(habit.createdAt) : NEW_SCORING_START;
    for (let cursor = new Date(`${firstDay}T12:00:00Z`); cursor < new Date(`${today}T12:00:00Z`); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const day = cursor.toISOString().slice(0, 10);
      const status = completionStatus.get(`${habit.id}:${day}`);
      if (status === "completed" || status === "dismissed") continue;
      await recordActivityOutcome(db, { userId, sourceType: "habit", sourceId: habit.id, occurrenceDate: day, category: habit.category, basePoints: pointsForCategory(habit.category), isCorrosive: habit.isCorrosive, outcome: "missed" });
    }
  }
  for (const task of taskRows) {
    const dueDay = task.dueDate ? dateKey(task.dueDate) : null;
    if (task.status === "completed" || !dueDay || dueDay < NEW_SCORING_START || dueDay >= today) continue;
    await recordActivityOutcome(db, { userId, sourceType: "task", sourceId: task.id, occurrenceDate: dueDay, category: task.category, basePoints: pointsForCategory(task.category), isCorrosive: task.isCorrosive, outcome: "missed" });
  }
}

function weekStartKey(today: string) { const date = new Date(`${today}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7)); return date.toISOString().slice(0, 10); }
function overdueLoss(category: string | null | undefined) { return -Math.max(2, Math.round(pointsForCategory(category) / 2)); }

export function calculateGoalProgress(goal: { automationType: string; automationRefId: number | null; progress: number; target: number; automationStartDate: Date | string | null; createdAt: Date | string }, source: { habitCompletions: Array<{ habitId: number; day: Date | string; status: string }>; tasks: Array<{ status: string; updatedAt: Date | string; goalId?: number | null }>; focus: Array<{ durationMinutes: number; createdAt: Date | string }>; trainingDates: Array<Date | string>; nutritionDates: Array<Date | string> }, today: string) {
  const start = dateKey(goal.automationStartDate ?? goal.createdAt);
  const inRange = (value: Date | string | null | undefined) => { if (!value) return false; const day = dateKey(value); return day >= start && day <= today; };
  let progress = goal.progress;
  if (goal.automationType === "habit") progress = source.habitCompletions.filter(item => item.status === "completed" && item.habitId === goal.automationRefId && inRange(item.day)).length;
  if (goal.automationType === "tasks") progress = source.tasks.filter(item => item.status === "completed" && inRange(item.updatedAt) && (goal.automationRefId == null || item.goalId === goal.automationRefId)).length;
  if (goal.automationType === "focus") progress = source.focus.filter(item => inRange(item.createdAt)).reduce((sum, item) => sum + item.durationMinutes, 0);
  if (goal.automationType === "training") progress = source.trainingDates.filter(inRange).length;
  if (goal.automationType === "nutrition") progress = source.nutritionDates.filter(inRange).length;
  return Math.min(goal.target, Math.max(0, progress));
}

async function hydrateGoalProgress(db: Awaited<ReturnType<typeof requireDb>>, userId: number, rows: typeof goals.$inferSelect[], today: string) {
  const [completions, taskRows, focusRows, records] = await Promise.all([
    db.select().from(habitCompletions).where(eq(habitCompletions.userId, userId)),
    db.select().from(tasks).where(eq(tasks.userId, userId)),
    db.select().from(focusSessions).where(eq(focusSessions.userId, userId)),
    db.select().from(moduleRecords).where(eq(moduleRecords.userId, userId)),
  ]);
  return rows.map(goal => {
    const bounded = calculateGoalProgress(goal, { habitCompletions: completions, tasks: taskRows, focus: focusRows, trainingDates: records.filter(item => item.module === "treinos").map(item => item.recordDate ?? item.createdAt), nutritionDates: records.filter(item => item.module === "alimentacao").map(item => item.recordDate ?? item.createdAt) }, today);
    return { ...goal, progress: bounded, computedStatus: goal.automationType !== "manual" && bounded >= goal.target ? "completed" : goal.status, isOverdue: Boolean(goal.deadline && dateKey(goal.deadline) < today && bounded < goal.target) };
  });
}

function decodeDetails(raw: string | null) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function serializeRecord(record: typeof moduleRecords.$inferSelect) {
  return {
    ...record,
    recordDate: record.recordDate ? dateKey(record.recordDate) : null,
    details: decodeDetails(record.details),
  };
}

const moduleSchema = z.enum(["treinos", "alimentacao", "financas", "recompensas"]);
const recordInput = z.object({
  module: moduleSchema,
  title: z.string().trim().min(2).max(200),
  subtitle: z.string().trim().max(240).optional(),
  status: z.string().trim().max(32).default("active"),
  numericValue: z.number().int().min(-100000000).max(100000000).default(0),
  amountCents: z.number().int().min(-1000000000).max(1000000000).default(0),
  recordDate: daySchema.nullable().optional(),
  details: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
});

const rewardInput = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(500).nullable().optional(),
  category: z.string().trim().max(80).default("Lazer"),
  imageUrl: z.string().trim().url().max(1000).nullable().optional(),
  costPoints: z.number().int().min(0).max(1000000),
});

const habitInput = z.object({
  name: z.string().trim().min(2).max(160),
  category: z.string().trim().max(80).optional(),
  isCorrosive: z.boolean().default(false),
  frequency: z.enum(["daily", "weekly", "custom"]).default("daily"),
});

const taskInput = z.object({
  title: z.string().trim().min(2).max(200),
  category: z.string().trim().max(80).optional(),
  isCorrosive: z.boolean().default(false),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dueDate: daySchema.nullable().optional(),
  goalId: idSchema.nullable().optional(),
});

const goalInput = z.object({
  title: z.string().trim().min(2).max(200),
  category: z.string().trim().max(80).optional(),
  target: z.number().int().min(1).max(1000000).default(100),
  deadline: daySchema.nullable().optional(),
  automationType: z.enum(["manual", "habit", "tasks", "focus", "training", "nutrition"]).default("manual"),
  automationRefId: z.number().int().positive().nullable().optional(),
});

const trainingPlanInput = z.object({
  name: z.string().trim().min(2).max(160),
  category: z.string().trim().min(2).max(80),
  modality: z.enum(["musculacao", "calistenia", "casa", "cardio", "mobilidade"]),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7),
});

const trainingExerciseInput = z.object({
  planId: idSchema,
  name: z.string().trim().min(2).max(160),
  muscleGroup: z.string().trim().min(2).max(80),
  equipment: z.string().trim().max(120).optional(),
  description: z.string().trim().max(500).optional(),
  plannedSets: z.number().int().min(1).max(30),
  plannedReps: z.number().int().min(1).max(200),
  plannedWeightKg: z.number().int().min(0).max(2000),
  restSeconds: z.number().int().min(0).max(3600),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  points: router({
    weekly: protectedProcedure.input(z.object({ today: daySchema })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      const start = weekStartKey(input.today);
      await reconcileMissedActivities(db, ctx.user.id, input.today);
      const [habitRows, completionRows, taskRows, goalRows, focusRows, spendingRows] = await Promise.all([
        db.select().from(habits).where(eq(habits.userId, ctx.user.id)),
        db.select().from(habitCompletions).where(eq(habitCompletions.userId, ctx.user.id)),
        db.select().from(tasks).where(eq(tasks.userId, ctx.user.id)),
        db.select().from(goals).where(eq(goals.userId, ctx.user.id)),
        db.select().from(focusSessions).where(eq(focusSessions.userId, ctx.user.id)),
        db.select().from(pointTransactions).where(eq(pointTransactions.userId, ctx.user.id)),
      ]);
      const completedHabitDays = new Set(completionRows.filter(row => row.status === "completed" && dateKey(row.day) >= start && dateKey(row.day) <= input.today).map(row => `${row.habitId}:${dateKey(row.day)}`));
      const missedHabitDays = new Set(completionRows.filter(row => row.status === "missed" && dateKey(row.day) >= start && dateKey(row.day) <= input.today).map(row => `${row.habitId}:${dateKey(row.day)}`));
      let habitDone = 0; let habitMissed = 0;
      for (const habit of habitRows.filter(row => row.active && row.frequency === "daily")) {
        const created = dateKey(habit.createdAt);
        for (let cursor = new Date(`${start}T12:00:00Z`); cursor <= new Date(`${input.today}T12:00:00Z`); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
          const day = cursor.toISOString().slice(0, 10); if (day < created || day >= NEW_SCORING_START) continue;
          if (completedHabitDays.has(`${habit.id}:${day}`)) habitDone += POINTS.habitDone;
          else if (missedHabitDays.has(`${habit.id}:${day}`) || day < input.today) habitMissed += POINTS.habitMissed;
        }
      }
      const completedTasks = taskRows.filter(task => task.status === "completed" && dateKey(task.updatedAt) >= start && dateKey(task.updatedAt) <= input.today && dateKey(task.updatedAt) < NEW_SCORING_START);
      const overdueTasks = taskRows.filter(task => task.status !== "completed" && task.dueDate && dateKey(task.dueDate) >= start && dateKey(task.dueDate) < input.today && dateKey(task.dueDate) < NEW_SCORING_START);
      const completedTaskPoints = completedTasks.reduce((sum, task) => sum + legacyPointsForCategory(task.category), 0);
      const habitEvents = completionRows.filter(row => row.status === "completed" && dateKey(row.day) >= start && dateKey(row.day) <= input.today && dateKey(row.day) < NEW_SCORING_START).map(row => ({ day: dateKey(row.day), category: habitRows.find(habit => habit.id === row.habitId)?.category ?? "Hábitos", points: POINTS.habitDone }));
      const taskEvents = completedTasks.map(task => ({ day: dateKey(task.updatedAt), category: task.category, points: legacyPointsForCategory(task.category) }));
      const dedupeKeys = new Set<string>();
      let dedupedEarned = 0;
      for (const event of [...habitEvents, ...taskEvents]) {
        const key = `${event.day}:${event.category}`;
        if (dedupeKeys.has(key)) continue;
        dedupeKeys.add(key);
        const sameDayActions = [...habitEvents, ...taskEvents].filter(item => item.day === event.day && item.category === event.category);
        dedupedEarned += Math.max(...sameDayActions.map(item => item.points));
      }
      const taskLost = overdueTasks.reduce((sum, task) => sum + (-Math.max(2, Math.round(legacyPointsForCategory(task.category) / 2))), 0);
      const goalEarned = goalRows.filter(goal => goal.status === "completed" && dateKey(goal.updatedAt) >= start && dateKey(goal.updatedAt) <= input.today).length * POINTS.goalDone;
      const focusEarned = Math.min(5, Math.floor(focusRows.filter(session => dateKey(session.createdAt) >= start && dateKey(session.createdAt) <= input.today).reduce((sum, session) => sum + session.durationMinutes, 0) / 25)) * POINTS.focusBlock;
      const newLedgerRows = spendingRows.filter(row => row.movementType !== "legacy" && row.occurrenceDate && dateKey(row.occurrenceDate) >= start && dateKey(row.occurrenceDate) <= input.today);
      const newLedgerEarned = newLedgerRows.reduce((sum, row) => sum + Math.max(0, row.points), 0);
      const newLedgerLost = newLedgerRows.reduce((sum, row) => sum + Math.min(0, row.points), 0);
      const earned = Math.max(0, dedupedEarned + goalEarned + focusEarned) + newLedgerEarned;
      const lost = Math.abs(habitMissed + taskLost + newLedgerLost);
      const spent = spendingRows.filter(row => row.movementType === "legacy").reduce((sum, row) => sum + Math.max(0, row.points), 0);
      const net = earned - lost;
      const walletBalance = net - spent;
      const obligations = habitRows.filter(row => row.active && row.frequency === "daily").length * Math.max(0, Math.floor((new Date(`${input.today}T12:00:00Z`).getTime() - new Date(`${start}T12:00:00Z`).getTime()) / 86400000) + 1) + taskRows.filter(task => (task.dueDate && dateKey(task.dueDate) >= start && dateKey(task.dueDate) <= input.today) || task.status === "completed").length;
      const completedObligations = completedHabitDays.size + completedTasks.length;
      return { start, today: input.today, earned, lost, net, spent, walletBalance, completionRate: obligations ? Math.round((completedObligations / obligations) * 100) : 0, breakdown: { habits: habitDone + habitMissed, tasks: completedTaskPoints + taskLost, goals: goalEarned, focus: focusEarned, overdueTasks: overdueTasks.length, newLedger: newLedgerEarned + newLedgerLost }, rules: { categoryPoints: CATEGORY_POINTS, failureFormula: "falha normal perde metade; falha corrosiva perde o dobro", legacyBoundary: NEW_SCORING_START, deduplication: "cada atividade possui uma chave própria; transições repetidas não duplicam o mesmo estado" } };
    }),
  }),

  dashboard: router({
    snapshot: protectedProcedure
      .input(z.object({ today: daySchema }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        const userId = ctx.user.id;
        const [habitRows, completionRows, taskRows, goalRows, focusRows] = await Promise.all([
          db.select().from(habits).where(and(eq(habits.userId, userId), eq(habits.active, true))).orderBy(desc(habits.createdAt)),
          db.select().from(habitCompletions).where(eq(habitCompletions.userId, userId)).orderBy(desc(habitCompletions.day)),
          db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(desc(tasks.createdAt)),
          db.select().from(goals).where(eq(goals.userId, userId)).orderBy(desc(goals.updatedAt)),
          db.select().from(focusSessions).where(eq(focusSessions.userId, userId)).orderBy(desc(focusSessions.createdAt)),
        ]);

        const completionsByHabit = new Map<number, Set<string>>();
        for (const completion of completionRows) {
          if (completion.status !== "completed") continue;
          const set = completionsByHabit.get(completion.habitId) ?? new Set<string>();
          set.add(dateKey(completion.day));
          completionsByHabit.set(completion.habitId, set);
        }
        const todayCompleted = new Set(
          completionRows.filter(item => dateKey(item.day) === input.today && item.status === "completed").map(item => item.habitId),
        );
        const habitSummary = habitRows.map(habit => ({
          ...habit,
          completedToday: todayCompleted.has(habit.id),
          streak: calculateStreak(completionsByHabit.get(habit.id) ?? new Set(), input.today),
        }));

        const overdueTasks = taskRows.filter(task => task.status !== "completed" && task.dueDate && dateKey(task.dueDate) < input.today);
        const openTasks = taskRows
          .filter(task => task.status !== "completed" && (!task.dueDate || dateKey(task.dueDate) >= input.today))
          .sort((a, b) => pointsForCategory(b.category) - pointsForCategory(a.category) || sortableDate(a.dueDate).localeCompare(sortableDate(b.dueDate)))
          .slice(0, 6)
          .map(task => ({ ...task, points: pointsForCategory(task.category) }));
        const todayTasks = taskRows.filter(task => dateKey(task.createdAt) === input.today || Boolean(task.dueDate && dateKey(task.dueDate) === input.today)).sort((a, b) => Number(a.status === "completed") - Number(b.status === "completed"));
        const categoryStats = Object.entries(taskRows.reduce<Record<string, { total: number; completed: number; points: number }>>((result, task) => {
          const current = result[task.category] ?? { total: 0, completed: 0, points: pointsForCategory(task.category) };
          current.total += 1;
          if (task.status === "completed") current.completed += 1;
          result[task.category] = current;
          return result;
        }, {})).map(([category, values]) => ({ category, ...values, rate: values.total ? Math.round((values.completed / values.total) * 100) : 0 })).sort((a, b) => a.rate - b.rate);
        const taskInsights = { todayTotal: todayTasks.length, todayCompleted: todayTasks.filter(task => task.status === "completed").length, strongestCategory: [...categoryStats].sort((a, b) => b.rate - a.rate)[0]?.category ?? null, difficultCategory: categoryStats[0]?.category ?? null, categoryStats };
        const completedTasks = taskRows.filter(task => task.status === "completed").length;
        const totalSignals = habitRows.length + taskRows.length;
        const completedSignals = todayCompleted.size + completedTasks - overdueTasks.length;
        const score = totalSignals === 0 ? 0 : Math.max(0, Math.min(100, Math.round((completedSignals / totalSignals) * 100)));
        const focusMinutes = focusRows.reduce((sum, session) => sum + session.durationMinutes, 0);
        const weekStart = new Date(`${input.today}T12:00:00Z`);
        weekStart.setUTCDate(weekStart.getUTCDate() - 6);
        const weeklyFocusMinutes = focusRows
          .filter(session => session.createdAt >= weekStart)
          .reduce((sum, session) => sum + session.durationMinutes, 0);
        const activityDates = Array.from(new Set([
          ...completionRows.filter(item => item.status === "completed").map(item => dateKey(item.day)),
          ...taskRows.filter(item => item.status === "completed" && item.updatedAt).map(item => dateKey(item.updatedAt)),
          ...focusRows.map(item => dateKey(item.createdAt)),
        ])).sort();

        const hydratedGoals = await hydrateGoalProgress(db, userId, goalRows, input.today);
        return {
          user: ctx.user,
          score,
          habits: habitSummary,
          tasks: openTasks,
          todayTasks,
          taskInsights,
          goals: hydratedGoals,
          counts: {
            habits: habitRows.length,
            completedHabitsToday: todayCompleted.size,
            openTasks: openTasks.length,
            overdueTasks: overdueTasks.length,
            completedTasks,
            focusMinutes,
            weeklyFocusMinutes,
          },
          streak: Math.max(0, ...habitSummary.map(habit => habit.streak)),
          activityDates,
          today: input.today,
        };
      }),
  }),

  habits: router({
    create: protectedProcedure.input(habitInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.insert(habits).values({
        userId: ctx.user.id,
        name: input.name,
        category: input.category || "Disciplina",
        isCorrosive: input.isCorrosive,
        frequency: input.frequency,
      });
      return { success: true } as const;
    }),
    update: protectedProcedure.input(habitInput.extend({ habitId: idSchema, active: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const own = await db.select({ id: habits.id }).from(habits).where(and(eq(habits.id, input.habitId), eq(habits.userId, ctx.user.id))).limit(1);
      if (!own[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Hábito não encontrado." });
      await db.update(habits).set({ name: input.name, category: input.category || "Disciplina", isCorrosive: input.isCorrosive, frequency: input.frequency, active: input.active ?? true }).where(and(eq(habits.id, input.habitId), eq(habits.userId, ctx.user.id)));
      return { success: true } as const;
    }),
    toggleToday: protectedProcedure.input(z.object({ habitId: idSchema, day: daySchema, completed: z.boolean() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const ownHabit = await db.select({ id: habits.id, category: habits.category, isCorrosive: habits.isCorrosive }).from(habits).where(and(eq(habits.id, input.habitId), eq(habits.userId, ctx.user.id))).limit(1);
      if (!ownHabit[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Hábito não encontrado." });
      const day = new Date(`${input.day}T00:00:00.000Z`);
      const existing = await db.select().from(habitCompletions).where(and(eq(habitCompletions.habitId, input.habitId), eq(habitCompletions.userId, ctx.user.id), eq(habitCompletions.day, day))).limit(1);
      if (existing[0]) {
        await db.update(habitCompletions).set({ status: input.completed ? "completed" : "missed" }).where(eq(habitCompletions.id, existing[0].id));
      } else await db.insert(habitCompletions).values({ userId: ctx.user.id, habitId: input.habitId, day, status: input.completed ? "completed" : "missed" });
      await recordActivityOutcome(db, { userId: ctx.user.id, sourceType: "habit", sourceId: input.habitId, occurrenceDate: input.day, category: ownHabit[0].category, basePoints: pointsForCategory(ownHabit[0].category), isCorrosive: existing[0] ? (await db.select({ isCorrosive: pointActivities.isCorrosive }).from(pointActivities).where(and(eq(pointActivities.userId, ctx.user.id), eq(pointActivities.sourceType, "habit"), eq(pointActivities.sourceId, input.habitId), eq(pointActivities.occurrenceDate, day))).limit(1))[0]?.isCorrosive ?? ownHabit[0].isCorrosive : ownHabit[0].isCorrosive, outcome: input.completed ? "completed" : "missed" });
      return { success: true } as const;
    }),
    delete: protectedProcedure.input(z.object({ habitId: idSchema })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const own = await db.select({ id: habits.id }).from(habits).where(and(eq(habits.id, input.habitId), eq(habits.userId, ctx.user.id))).limit(1);
      if (!own[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Hábito não encontrado." });
      await db.update(habits).set({ active: false }).where(and(eq(habits.id, input.habitId), eq(habits.userId, ctx.user.id)));
      return { success: true } as const;
    }),
  }),

  tasks: router({
    create: protectedProcedure.input(taskInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      if (input.goalId) {
        const ownGoal = await db.select({ id: goals.id }).from(goals).where(and(eq(goals.id, input.goalId), eq(goals.userId, ctx.user.id))).limit(1);
        if (!ownGoal[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "A meta selecionada não pertence à sua conta." });
      }
      await db.insert(tasks).values({ userId: ctx.user.id, title: input.title, category: input.category || "Geral", isCorrosive: input.isCorrosive, priority: "medium", dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null, goalId: input.goalId ?? null });
      return { success: true } as const;
    }),
    update: protectedProcedure.input(taskInput.extend({ taskId: idSchema, status: z.enum(["todo", "in_progress", "completed"]).optional() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const ownTask = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.id, input.taskId), eq(tasks.userId, ctx.user.id))).limit(1);
      if (!ownTask[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Tarefa não encontrada." });
      if (input.goalId) {
        const ownGoal = await db.select({ id: goals.id }).from(goals).where(and(eq(goals.id, input.goalId), eq(goals.userId, ctx.user.id))).limit(1);
        if (!ownGoal[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "A meta selecionada não pertence à sua conta." });
      }
      await db.update(tasks).set({ title: input.title, category: input.category || "Geral", isCorrosive: input.isCorrosive, priority: "medium", dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null, goalId: input.goalId ?? null, status: input.status ?? "todo" }).where(and(eq(tasks.id, input.taskId), eq(tasks.userId, ctx.user.id)));
      return { success: true } as const;
    }),
    toggleComplete: protectedProcedure.input(z.object({ taskId: idSchema, completed: z.boolean(), today: daySchema.optional() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const ownTask = await db.select({ id: tasks.id, dueDate: tasks.dueDate, status: tasks.status, category: tasks.category, isCorrosive: tasks.isCorrosive }).from(tasks).where(and(eq(tasks.id, input.taskId), eq(tasks.userId, ctx.user.id))).limit(1);
      if (!ownTask[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Tarefa não encontrada." });
      const today = input.today ?? dateKey(new Date());
      if (input.completed && ownTask[0].dueDate && dateKey(ownTask[0].dueDate) < today) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "O prazo desta tarefa já terminou e ela foi considerada não concluída." });
      }
      await db.update(tasks).set({ status: input.completed ? "completed" : "todo" }).where(and(eq(tasks.id, input.taskId), eq(tasks.userId, ctx.user.id)));
      await recordActivityOutcome(db, { userId: ctx.user.id, sourceType: "task", sourceId: input.taskId, occurrenceDate: today, category: ownTask[0].category, basePoints: pointsForCategory(ownTask[0].category), isCorrosive: ownTask[0].isCorrosive, outcome: input.completed ? "completed" : "missed" });
      return { success: true } as const;
    }),
    delete: protectedProcedure.input(z.object({ taskId: idSchema })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const ownTask = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.id, input.taskId), eq(tasks.userId, ctx.user.id))).limit(1);
      if (!ownTask[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Tarefa não encontrada." });
      await db.delete(tasks).where(and(eq(tasks.id, input.taskId), eq(tasks.userId, ctx.user.id)));
      return { success: true } as const;
    }),
  }),

  goals: router({
    create: protectedProcedure.input(goalInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      if (input.automationType === "habit") {
        const ownHabit = input.automationRefId ? await db.select({ id: habits.id }).from(habits).where(and(eq(habits.id, input.automationRefId), eq(habits.userId, ctx.user.id))).limit(1) : [];
        if (!ownHabit[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "Escolha um hábito da sua conta para automatizar esta meta." });
      }
      const inserted = await db.insert(goals).values({ userId: ctx.user.id, title: input.title, category: input.category || "Pessoal", target: input.target, deadline: input.deadline ? new Date(`${input.deadline}T00:00:00.000Z`) : null, automationType: input.automationType, automationRefId: input.automationType === "habit" ? input.automationRefId ?? null : null, automationStartDate: input.automationType === "manual" ? null : new Date() });
      if (input.automationType === "tasks") await db.update(goals).set({ automationRefId: Number(inserted[0].insertId) }).where(and(eq(goals.id, Number(inserted[0].insertId)), eq(goals.userId, ctx.user.id)));
      return { success: true } as const;
    }),
    update: protectedProcedure.input(goalInput.extend({ goalId: idSchema, status: z.enum(["active", "completed", "paused"]).optional() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const ownGoal = await db.select({ id: goals.id }).from(goals).where(and(eq(goals.id, input.goalId), eq(goals.userId, ctx.user.id))).limit(1);
      if (!ownGoal[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Meta não encontrada." });
      if (input.automationType === "habit") {
        const ownHabit = input.automationRefId ? await db.select({ id: habits.id }).from(habits).where(and(eq(habits.id, input.automationRefId), eq(habits.userId, ctx.user.id))).limit(1) : [];
        if (!ownHabit[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "Escolha um hábito da sua conta para automatizar esta meta." });
      }
      await db.update(goals).set({ title: input.title, category: input.category || "Pessoal", target: input.target, deadline: input.deadline ? new Date(`${input.deadline}T00:00:00.000Z`) : null, automationType: input.automationType, automationRefId: input.automationType === "habit" ? input.automationRefId ?? null : null, automationStartDate: input.automationType === "manual" ? null : new Date(), status: input.status ?? "active" }).where(and(eq(goals.id, input.goalId), eq(goals.userId, ctx.user.id)));
      return { success: true } as const;
    }),
    updateProgress: protectedProcedure.input(z.object({ goalId: idSchema, progress: z.number().int().min(0).max(1000000) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const existing = await db.select({ automationType: goals.automationType }).from(goals).where(and(eq(goals.id, input.goalId), eq(goals.userId, ctx.user.id))).limit(1);
      if (!existing[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Meta não encontrada." });
      if (existing[0].automationType !== "manual") throw new TRPCError({ code: "BAD_REQUEST", message: "O progresso desta meta é atualizado pelos registros reais." });
      await db.update(goals).set({ progress: input.progress, status: input.progress >= 100 ? "completed" : "active" }).where(and(eq(goals.id, input.goalId), eq(goals.userId, ctx.user.id)));
      return { success: true } as const;
    }),
    delete: protectedProcedure.input(z.object({ goalId: idSchema })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const ownGoal = await db.select({ id: goals.id }).from(goals).where(and(eq(goals.id, input.goalId), eq(goals.userId, ctx.user.id))).limit(1);
      if (!ownGoal[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Meta não encontrada." });
      await db.delete(goals).where(and(eq(goals.id, input.goalId), eq(goals.userId, ctx.user.id)));
      return { success: true } as const;
    }),
  }),

  records: router({
    list: protectedProcedure.input(z.object({ module: moduleSchema })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      const rows = await db.select().from(moduleRecords).where(and(eq(moduleRecords.userId, ctx.user.id), eq(moduleRecords.module, input.module))).orderBy(desc(moduleRecords.recordDate), desc(moduleRecords.createdAt));
      return rows.map(serializeRecord);
    }),
    create: protectedProcedure.input(recordInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const inserted = await db.insert(moduleRecords).values({
        userId: ctx.user.id,
        module: input.module,
        title: input.title,
        subtitle: input.subtitle || null,
        status: input.status,
        numericValue: input.numericValue,
        amountCents: input.amountCents,
        recordDate: input.recordDate ? new Date(`${input.recordDate}T00:00:00.000Z`) : null,
        details: JSON.stringify(input.details),
      });
      const id = Number(inserted[0].insertId);
      await db.insert(auditLogs).values({ userId: ctx.user.id, action: "create", entity: input.module, entityId: id, afterData: JSON.stringify(input) });
      return { success: true, id } as const;
    }),
    update: protectedProcedure.input(recordInput.extend({ id: idSchema })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const existing = await db.select().from(moduleRecords).where(and(eq(moduleRecords.id, input.id), eq(moduleRecords.userId, ctx.user.id))).limit(1);
      if (!existing[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Registro não encontrado." });
      await db.update(moduleRecords).set({ title: input.title, subtitle: input.subtitle || null, status: input.status, numericValue: input.numericValue, amountCents: input.amountCents, recordDate: input.recordDate ? new Date(`${input.recordDate}T00:00:00.000Z`) : null, details: JSON.stringify(input.details) }).where(eq(moduleRecords.id, input.id));
      await db.insert(auditLogs).values({ userId: ctx.user.id, action: "update", entity: input.module, entityId: input.id, beforeData: JSON.stringify(serializeRecord(existing[0])), afterData: JSON.stringify(input) });
      return { success: true } as const;
    }),
    delete: protectedProcedure.input(z.object({ id: idSchema })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const existing = await db.select().from(moduleRecords).where(and(eq(moduleRecords.id, input.id), eq(moduleRecords.userId, ctx.user.id))).limit(1);
      if (!existing[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Registro não encontrado." });
      await db.delete(moduleRecords).where(and(eq(moduleRecords.id, input.id), eq(moduleRecords.userId, ctx.user.id)));
      await db.insert(auditLogs).values({ userId: ctx.user.id, action: "delete", entity: existing[0].module, entityId: input.id, beforeData: JSON.stringify(serializeRecord(existing[0])) });
      return { success: true } as const;
    }),
    redeem: protectedProcedure.input(z.object({ id: idSchema, points: z.number().int().positive().max(100000) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const existing = await db.select().from(moduleRecords).where(and(eq(moduleRecords.id, input.id), eq(moduleRecords.userId, ctx.user.id), eq(moduleRecords.module, "recompensas"))).limit(1);
      if (!existing[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Recompensa não encontrada." });
      if (existing[0].status === "redeemed") throw new TRPCError({ code: "BAD_REQUEST", message: "Esta recompensa já foi resgatada." });
      await db.insert(pointTransactions).values({ userId: ctx.user.id, points: input.points, reason: `Resgate: ${existing[0].title}`, referenceId: input.id });
      await db.update(moduleRecords).set({ status: "redeemed" }).where(eq(moduleRecords.id, input.id));
      return { success: true } as const;
    }),
  }),

  rewards: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const [items, redemptions] = await Promise.all([
        db.select().from(rewards).where(eq(rewards.userId, ctx.user.id)).orderBy(desc(rewards.updatedAt)),
        db.select().from(rewardRedemptions).where(eq(rewardRedemptions.userId, ctx.user.id)).orderBy(desc(rewardRedemptions.redeemedAt)),
      ]);
      return { items, redemptions };
    }),
    create: protectedProcedure.input(rewardInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const inserted = await db.insert(rewards).values({ userId: ctx.user.id, title: input.title, description: input.description || null, category: input.category, imageUrl: input.imageUrl || null, costPoints: input.costPoints, status: "active" });
      return { success: true, id: Number(inserted[0].insertId) } as const;
    }),
    update: protectedProcedure.input(rewardInput.extend({ rewardId: idSchema })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const own = await db.select({ id: rewards.id }).from(rewards).where(and(eq(rewards.id, input.rewardId), eq(rewards.userId, ctx.user.id))).limit(1);
      if (!own[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Recompensa não encontrada." });
      await db.update(rewards).set({ title: input.title, description: input.description || null, category: input.category, imageUrl: input.imageUrl || null, costPoints: input.costPoints }).where(and(eq(rewards.id, input.rewardId), eq(rewards.userId, ctx.user.id)));
      return { success: true } as const;
    }),
    archive: protectedProcedure.input(z.object({ rewardId: idSchema })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const result = await db.update(rewards).set({ status: "archived" }).where(and(eq(rewards.id, input.rewardId), eq(rewards.userId, ctx.user.id)));
      if (!result[0]?.affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "Recompensa não encontrada." });
      return { success: true } as const;
    }),
    redeem: protectedProcedure.input(z.object({ rewardId: idSchema, idempotencyKey: z.string().trim().min(8).max(180) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      return db.transaction(async tx => {
        const reward = await tx.select().from(rewards).where(and(eq(rewards.id, input.rewardId), eq(rewards.userId, ctx.user.id), eq(rewards.status, "active"))).limit(1);
        if (!reward[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Recompensa não encontrada ou arquivada." });
        const existing = await tx.select({ id: pointTransactions.id }).from(pointTransactions).where(and(eq(pointTransactions.userId, ctx.user.id), eq(pointTransactions.idempotencyKey, input.idempotencyKey))).limit(1);
        if (existing[0]) return { success: true, duplicate: true } as const;
        const today = new Date();
        const occurrenceDate = new Date(`${today.toISOString().slice(0, 10)}T00:00:00.000Z`);
        const movement = await tx.insert(pointTransactions).values({ userId: ctx.user.id, points: -reward[0].costPoints, reason: `Resgate: ${reward[0].title}`, referenceId: reward[0].id, category: "Outros", movementType: "redemption", sourceType: "reward", sourceId: reward[0].id, occurrenceDate, idempotencyKey: input.idempotencyKey });
        await tx.insert(rewardRedemptions).values({ userId: ctx.user.id, rewardId: reward[0].id, costPoints: reward[0].costPoints, pointTransactionId: Number(movement[0].insertId) });
        return { success: true, duplicate: false } as const;
      });
    }),
  }),

  training: router({
    overview: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const [plans, exercises, sessions, library] = await Promise.all([
        db.select().from(trainingPlans).where(and(eq(trainingPlans.userId, ctx.user.id), eq(trainingPlans.active, true))).orderBy(desc(trainingPlans.updatedAt)),
        db.select().from(trainingExercises).where(eq(trainingExercises.userId, ctx.user.id)).orderBy(trainingExercises.sortOrder),
        db.select().from(trainingSessions).where(eq(trainingSessions.userId, ctx.user.id)).orderBy(desc(trainingSessions.sessionDate), desc(trainingSessions.createdAt)),
        db.select().from(exerciseLibrary).where(eq(exerciseLibrary.userId, ctx.user.id)).orderBy(exerciseLibrary.name),
      ]);
      const today = new Date();
      const weekday = today.getDay();
      const todayPlan = plans.find(plan => plan.weekdays.split(",").map(Number).includes(weekday)) ?? null;
      const weekStart = new Date(today);
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      const weekStartKey = weekStart.toISOString().slice(0, 10);
      const weekSessions = sessions.filter(session => dateKey(session.sessionDate) >= weekStartKey && session.status === "completed");
      const current = sessions.find(session => session.status === "in_progress") ?? null;
      return {
        plans: plans.map(plan => ({ ...plan, weekdays: plan.weekdays.split(",").filter(Boolean).map(Number), exercises: exercises.filter(item => item.planId === plan.id) })),
        library,
        todayPlan: todayPlan ? { ...todayPlan, weekdays: todayPlan.weekdays.split(",").filter(Boolean).map(Number), exercises: exercises.filter(item => item.planId === todayPlan.id) } : null,
        currentSession: current,
        lastCompleted: sessions.find(session => session.status === "completed") ?? null,
        weekSessions: weekSessions.length,
        totalSessions: sessions.filter(session => session.status === "completed").length,
        history: sessions.filter(session => session.status === "completed").slice(0, 20),
      };
    }),
    createPlan: protectedProcedure.input(trainingPlanInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const inserted = await db.insert(trainingPlans).values({ userId: ctx.user.id, name: input.name, category: input.category, modality: input.modality, weekdays: input.weekdays.sort((a, b) => a - b).join(",") });
      return { success: true, id: Number(inserted[0].insertId) } as const;
    }),
    updatePlan: protectedProcedure.input(trainingPlanInput.extend({ planId: idSchema })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.update(trainingPlans).set({ name: input.name, category: input.category, modality: input.modality, weekdays: input.weekdays.sort((a, b) => a - b).join(",") }).where(and(eq(trainingPlans.id, input.planId), eq(trainingPlans.userId, ctx.user.id)));
      return { success: true } as const;
    }),
    deletePlan: protectedProcedure.input(z.object({ planId: idSchema })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.update(trainingPlans).set({ active: false }).where(and(eq(trainingPlans.id, input.planId), eq(trainingPlans.userId, ctx.user.id)));
      return { success: true } as const;
    }),
    createExercise: protectedProcedure.input(trainingExerciseInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const ownPlan = await db.select({ id: trainingPlans.id }).from(trainingPlans).where(and(eq(trainingPlans.id, input.planId), eq(trainingPlans.userId, ctx.user.id))).limit(1);
      if (!ownPlan[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "A ficha não pertence à sua conta." });
      const current = await db.select({ sortOrder: trainingExercises.sortOrder }).from(trainingExercises).where(and(eq(trainingExercises.planId, input.planId), eq(trainingExercises.userId, ctx.user.id))).orderBy(desc(trainingExercises.sortOrder)).limit(1);
      const inserted = await db.insert(trainingExercises).values({ userId: ctx.user.id, planId: input.planId, name: input.name, muscleGroup: input.muscleGroup, equipment: input.equipment || null, description: input.description || null, sortOrder: (current[0]?.sortOrder ?? -1) + 1, plannedSets: input.plannedSets, plannedReps: input.plannedReps, plannedWeightKg: input.plannedWeightKg, restSeconds: input.restSeconds });
      return { success: true, id: Number(inserted[0].insertId) } as const;
    }),
    deleteExercise: protectedProcedure.input(z.object({ exerciseId: idSchema })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.delete(trainingExercises).where(and(eq(trainingExercises.id, input.exerciseId), eq(trainingExercises.userId, ctx.user.id)));
      return { success: true } as const;
    }),
    createLibraryExercise: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(160), muscleGroup: z.string().trim().min(2).max(80), equipment: z.string().trim().max(120).optional(), description: z.string().trim().max(500).optional(), demonstrationUrl: z.string().url().max(500).optional() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const inserted = await db.insert(exerciseLibrary).values({ userId: ctx.user.id, name: input.name, muscleGroup: input.muscleGroup, equipment: input.equipment || null, description: input.description || null, demonstrationUrl: input.demonstrationUrl || null });
      return { success: true, id: Number(inserted[0].insertId) } as const;
    }),
    startSession: protectedProcedure.input(z.object({ planId: idSchema, sessionDate: daySchema })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const ownPlan = await db.select({ id: trainingPlans.id }).from(trainingPlans).where(and(eq(trainingPlans.id, input.planId), eq(trainingPlans.userId, ctx.user.id), eq(trainingPlans.active, true))).limit(1);
      if (!ownPlan[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Ficha de treino não encontrada." });
      const open = await db.select({ id: trainingSessions.id }).from(trainingSessions).where(and(eq(trainingSessions.userId, ctx.user.id), eq(trainingSessions.status, "in_progress"))).limit(1);
      if (open[0]) return { success: true, id: open[0].id } as const;
      const inserted = await db.insert(trainingSessions).values({ userId: ctx.user.id, planId: input.planId, sessionDate: new Date(`${input.sessionDate}T00:00:00.000Z`), startedAt: new Date(), status: "in_progress" });
      const sessionId = Number(inserted[0].insertId);
      const exercises = await db.select().from(trainingExercises).where(and(eq(trainingExercises.planId, input.planId), eq(trainingExercises.userId, ctx.user.id))).orderBy(trainingExercises.sortOrder);
      for (const exercise of exercises) {
        for (let setNumber = 1; setNumber <= exercise.plannedSets; setNumber += 1) {
          await db.insert(trainingSets).values({ userId: ctx.user.id, sessionId, exerciseId: exercise.id, setNumber, plannedReps: exercise.plannedReps, plannedWeightKg: exercise.plannedWeightKg });
        }
      }
      return { success: true, id: sessionId } as const;
    }),
    session: protectedProcedure.input(z.object({ sessionId: idSchema })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      const session = await db.select().from(trainingSessions).where(and(eq(trainingSessions.id, input.sessionId), eq(trainingSessions.userId, ctx.user.id))).limit(1);
      if (!session[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada." });
      const [sets, exercises] = await Promise.all([
        db.select().from(trainingSets).where(and(eq(trainingSets.sessionId, input.sessionId), eq(trainingSets.userId, ctx.user.id))).orderBy(trainingSets.exerciseId, trainingSets.setNumber),
        db.select().from(trainingExercises).where(and(eq(trainingExercises.planId, session[0].planId), eq(trainingExercises.userId, ctx.user.id))).orderBy(trainingExercises.sortOrder),
      ]);
      return { session: session[0], exercises, sets };
    }),
    saveSet: protectedProcedure.input(z.object({ sessionId: idSchema, exerciseId: idSchema, setNumber: z.number().int().positive(), actualReps: z.number().int().min(0).max(500), actualWeightKg: z.number().int().min(0).max(2000), completed: z.boolean() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const ownSession = await db.select({ id: trainingSessions.id }).from(trainingSessions).where(and(eq(trainingSessions.id, input.sessionId), eq(trainingSessions.userId, ctx.user.id), eq(trainingSessions.status, "in_progress"))).limit(1);
      if (!ownSession[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "A sessão não está aberta." });
      const ownExercise = await db.select({ id: trainingExercises.id }).from(trainingExercises).innerJoin(trainingSessions, eq(trainingSessions.planId, trainingExercises.planId)).where(and(eq(trainingExercises.id, input.exerciseId), eq(trainingExercises.userId, ctx.user.id), eq(trainingSessions.id, input.sessionId), eq(trainingSessions.userId, ctx.user.id))).limit(1);
      if (!ownExercise[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "O exercício não pertence à ficha desta sessão." });
      const existing = await db.select({ id: trainingSets.id }).from(trainingSets).where(and(eq(trainingSets.sessionId, input.sessionId), eq(trainingSets.exerciseId, input.exerciseId), eq(trainingSets.setNumber, input.setNumber), eq(trainingSets.userId, ctx.user.id))).limit(1);
      const values = { actualReps: input.actualReps, actualWeightKg: input.actualWeightKg, completed: input.completed, completedAt: input.completed ? new Date() : null };
      if (existing[0]) await db.update(trainingSets).set(values).where(and(eq(trainingSets.id, existing[0].id), eq(trainingSets.userId, ctx.user.id)));
      else await db.insert(trainingSets).values({ userId: ctx.user.id, sessionId: input.sessionId, exerciseId: input.exerciseId, setNumber: input.setNumber, plannedReps: input.actualReps, plannedWeightKg: input.actualWeightKg, ...values });
      return { success: true } as const;
    }),
    finishSession: protectedProcedure.input(z.object({ sessionId: idSchema, notes: z.string().trim().max(1000).optional() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const session = await db.select().from(trainingSessions).where(and(eq(trainingSessions.id, input.sessionId), eq(trainingSessions.userId, ctx.user.id))).limit(1);
      if (!session[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada." });
      await db.update(trainingSessions).set({ status: "completed", endedAt: new Date(), notes: input.notes || null }).where(and(eq(trainingSessions.id, input.sessionId), eq(trainingSessions.userId, ctx.user.id)));
      return { success: true } as const;
    }),
  }),

  reports: router({
    summary: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const [records, habitRows, completionRows, taskRows, goalRows, focusRows] = await Promise.all([
        db.select().from(moduleRecords).where(eq(moduleRecords.userId, ctx.user.id)).orderBy(desc(moduleRecords.recordDate), desc(moduleRecords.createdAt)),
        db.select().from(habits).where(eq(habits.userId, ctx.user.id)),
        db.select().from(habitCompletions).where(and(eq(habitCompletions.userId, ctx.user.id), eq(habitCompletions.status, "completed"))),
        db.select().from(tasks).where(eq(tasks.userId, ctx.user.id)),
        db.select().from(goals).where(eq(goals.userId, ctx.user.id)),
        db.select().from(focusSessions).where(eq(focusSessions.userId, ctx.user.id)),
      ]);
      const month = new Date().toISOString().slice(0, 7);
      const monthRecords = records.filter(record => dateKey(record.recordDate ?? record.createdAt).startsWith(month));
      const finance = monthRecords.filter(record => record.module === "financas");
      const income = finance.filter(record => decodeDetails(record.details).type === "income").reduce((sum, record) => sum + Math.abs(record.amountCents), 0);
      const expenses = finance.filter(record => decodeDetails(record.details).type !== "income").reduce((sum, record) => sum + Math.abs(record.amountCents), 0);
      const nutrition = records.filter(record => record.module === "alimentacao" && dateKey(record.recordDate ?? record.createdAt) === dateKey(new Date())).reduce((sum, record) => sum + record.numericValue, 0);
      const xp = completionRows.length * 10 + taskRows.filter(task => task.status === "completed").length * 25 + goalRows.filter(goal => goal.status === "completed").length * 100 + focusRows.reduce((sum, session) => sum + session.durationMinutes, 0);
      const chartEnd = new Date();
      const dailyStats = Array.from({ length: 14 }, (_, index) => {
        const dayDate = new Date(chartEnd);
        dayDate.setHours(12, 0, 0, 0);
        dayDate.setDate(dayDate.getDate() - (13 - index));
        const day = dayDate.toISOString().slice(0, 10);
        const dayHabits = completionRows.filter(item => dateKey(item.day) === day);
        const dayTasks = taskRows.filter(item => item.status === "completed" && dateKey(item.updatedAt) === day);
        const categories = new Set<string>();
        let points = 0;
        for (const habit of dayHabits.filter(item => item.status === "completed")) {
          const category = habitRows.find(row => row.id === habit.habitId)?.category ?? "Hábitos";
          if (!categories.has(category)) { categories.add(category); points += POINTS.habitDone; }
        }
        for (const task of dayTasks) {
          if (!categories.has(task.category)) { categories.add(task.category); points += pointsForCategory(task.category); }
        }
        return { day, points, completedHabits: dayHabits.filter(item => item.status === "completed").length, completedTasks: dayTasks.length, focusMinutes: focusRows.filter(item => dateKey(item.createdAt) === day).reduce((sum, item) => sum + item.durationMinutes, 0) };
      });
      return {
        period: month,
        counts: { habits: habitRows.length, tasks: taskRows.length, completedTasks: taskRows.filter(task => task.status === "completed").length, goals: goalRows.length, focusSessions: focusRows.length, training: records.filter(record => record.module === "treinos").length },
        focusMinutes: focusRows.reduce((sum, session) => sum + session.durationMinutes, 0),
        finance: { income, expenses, balance: income - expenses },
        nutrition: { caloriesToday: nutrition },
        dailyStats,
        gamification: { xp, level: Math.floor(xp / 500) + 1, nextLevelXp: (Math.floor(xp / 500) + 1) * 500, achievements: [completionRows.length >= 7 ? "primeira semana" : null, taskRows.filter(task => task.status === "completed").length >= 10 ? "executor" : null, focusRows.length >= 5 ? "mente presente" : null].filter(Boolean) },
        records: records.slice(0, 80).map(serializeRecord),
      };
    }),
    monthly: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const [habitRows, completionRows, taskRows, goalRows, sessions] = await Promise.all([
        db.select().from(habits).where(eq(habits.userId, ctx.user.id)),
        db.select().from(habitCompletions).where(and(eq(habitCompletions.userId, ctx.user.id), eq(habitCompletions.status, "completed"))),
        db.select().from(tasks).where(eq(tasks.userId, ctx.user.id)),
        db.select().from(goals).where(eq(goals.userId, ctx.user.id)),
        db.select().from(trainingSessions).where(and(eq(trainingSessions.userId, ctx.user.id), eq(trainingSessions.status, "completed"))),
      ]);
      const now = new Date();
      const month = now.toISOString().slice(0, 7);
      const currentDay = now.getDate();
      const inMonth = (value: Date | string | null) => Boolean(value && dateKey(value).startsWith(month));
      const completedTasks = taskRows.filter(task => task.status === "completed" && inMonth(task.updatedAt));
      const monthCompletions = completionRows.filter(item => inMonth(item.day));
      const monthSessions = sessions.filter(item => inMonth(item.sessionDate));
      const monthTasksCreated = taskRows.filter(task => inMonth(task.createdAt));
      const monthGoals = goalRows.filter(goal => inMonth(goal.createdAt) || inMonth(goal.updatedAt));
      const activeDays = new Set<string>();
      completedTasks.forEach(task => activeDays.add(dateKey(task.updatedAt)));
      monthCompletions.forEach(item => activeDays.add(dateKey(item.day)));
      monthSessions.forEach(item => activeDays.add(dateKey(item.sessionDate)));
      const daily = Array.from({ length: currentDay }, (_, index) => {
        const dayDate = new Date(now.getFullYear(), now.getMonth(), index + 1, 12);
        const day = dayDate.toISOString().slice(0, 10);
        const categories = new Set<string>();
        let points = 0;
        for (const item of monthCompletions.filter(row => dateKey(row.day) === day)) {
          const category = habitRows.find(habit => habit.id === item.habitId)?.category ?? "Hábitos";
          if (!categories.has(category)) { categories.add(category); points += POINTS.habitDone; }
        }
        for (const task of completedTasks.filter(row => dateKey(row.updatedAt) === day)) {
          if (!categories.has(task.category)) { categories.add(task.category); points += pointsForCategory(task.category); }
        }
        for (const session of monthSessions.filter(row => dateKey(row.sessionDate) === day)) {
          if (!categories.has("Físico")) { categories.add("Físico"); points += 5; }
        }
        return { day, points };
      });
      const areaMap = new Map<string, { total: number; completed: number }>();
      const addArea = (category: string, completed: number, total: number) => {
        const current = areaMap.get(category) ?? { total: 0, completed: 0 };
        current.total += total;
        current.completed += completed;
        areaMap.set(category, current);
      };
      for (const task of monthTasksCreated) addArea(task.category, task.status === "completed" && inMonth(task.updatedAt) ? 1 : 0, 1);
      for (const item of monthCompletions) addArea(habitRows.find(habit => habit.id === item.habitId)?.category ?? "Hábitos", 1, 1);
      if (monthSessions.length) addArea("Físico", monthSessions.length, monthSessions.length);
      const areas = [...areaMap.entries()].map(([category, value]) => ({ category, ...value, rate: value.total ? Math.round((value.completed / value.total) * 100) : 0 })).sort((a, b) => b.rate - a.rate || b.completed - a.completed);
      const hasData = activeDays.size > 0 || monthTasksCreated.length > 0 || monthGoals.length > 0;
      const bestArea = areas[0] ?? null;
      const attentionArea = areas.length > 1 ? areas[areas.length - 1] : null;
      return {
        month,
        hasData,
        summary: { consistency: currentDay ? Math.round((activeDays.size / currentDay) * 100) : 0, activeDays: activeDays.size, completedTasks: completedTasks.length, accompaniedGoals: monthGoals.length },
        daily,
        areas,
        analysis: hasData ? { bestArea: bestArea?.category ?? null, attentionArea: attentionArea?.category ?? null, suggestions: [bestArea ? `Mantenha o ritmo em ${bestArea.category}.` : null, attentionArea ? `Revise a rotina de ${attentionArea.category} no próximo ciclo.` : null, completedTasks.length === 0 ? "Defina uma primeira tarefa com prazo real para criar uma referência." : null].filter(Boolean) } : null,
      };
    }),
  }),

  finance: router({
    ask: protectedProcedure.input(z.object({ question: z.string().trim().min(3).max(600) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const rows = await db.select().from(moduleRecords).where(and(eq(moduleRecords.userId, ctx.user.id), eq(moduleRecords.module, "financas"))).orderBy(desc(moduleRecords.recordDate), desc(moduleRecords.createdAt)).limit(500);
      if (rows.length === 0) return { answer: "Ainda não há transações suficientes para analisar. Registre receitas ou despesas primeiro.", grounded: true };
      const context = rows.map(row => ({ data: dateKey(row.recordDate ?? row.createdAt), title: row.title, amount: row.amountCents / 100, details: decodeDetails(row.details) }));
      try {
        const response = await invokeLLM({
          model: "gpt-5-mini",
          maxTokens: 700,
          messages: [
            { role: "system", content: "Você é o assistente financeiro privado do CAVEIRA. Responda em português brasileiro, de forma curta e prática. Use somente os lançamentos fornecidos. Nunca invente transações, saldos ou categorias. Se os dados não responderem à pergunta, diga explicitamente que faltam informações. Não prescreva investimentos, crédito ou decisões financeiras de alto risco." },
            { role: "user", content: `Pergunta: ${input.question}\n\nLançamentos reais registrados:\n${JSON.stringify(context)}` },
          ],
        });
        const content = response.choices?.[0]?.message?.content;
        if (typeof content === "string" && content.trim()) return { answer: content.trim(), grounded: true };
      } catch (error) {
        console.warn("[Finance AI] Falling back to deterministic summary", error instanceof Error ? error.message : "unknown error");
      }
      const expense = context.filter(item => item.details.type !== "income").reduce((sum, item) => sum + Math.abs(item.amount), 0);
      const income = context.filter(item => item.details.type === "income").reduce((sum, item) => sum + Math.abs(item.amount), 0);
      return { answer: `Com base nos ${rows.length} lançamentos registrados: receitas de R$ ${income.toFixed(2)}, despesas de R$ ${expense.toFixed(2)} e saldo observado de R$ ${(income - expense).toFixed(2)}. Para uma análise mais específica, registre categorias e pergunte novamente.`, grounded: true };
    }),
  }),

  backup: router({
    export: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const userId = ctx.user.id;
      const [recordRows, habitRows, completionRows, taskRows, goalRows, focusRows, activityRows, pointRows, auditRows, rewardRows, redemptionRows, settingsRows, libraryRows, planRows, exerciseRows, sessionRows, setRows] = await Promise.all([
        db.select().from(moduleRecords).where(eq(moduleRecords.userId, userId)),
        db.select().from(habits).where(eq(habits.userId, userId)),
        db.select().from(habitCompletions).where(eq(habitCompletions.userId, userId)),
        db.select().from(tasks).where(eq(tasks.userId, userId)),
        db.select().from(goals).where(eq(goals.userId, userId)),
        db.select().from(focusSessions).where(eq(focusSessions.userId, userId)),
        db.select().from(pointActivities).where(eq(pointActivities.userId, userId)),
        db.select().from(pointTransactions).where(eq(pointTransactions.userId, userId)),
        db.select().from(auditLogs).where(eq(auditLogs.userId, userId)),
        db.select().from(rewards).where(eq(rewards.userId, userId)),
        db.select().from(rewardRedemptions).where(eq(rewardRedemptions.userId, userId)),
        db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1),
        db.select().from(exerciseLibrary).where(eq(exerciseLibrary.userId, userId)),
        db.select().from(trainingPlans).where(eq(trainingPlans.userId, userId)),
        db.select().from(trainingExercises).where(eq(trainingExercises.userId, userId)),
        db.select().from(trainingSessions).where(eq(trainingSessions.userId, userId)),
        db.select().from(trainingSets).where(eq(trainingSets.userId, userId)),
      ]);
      return {
        version: 2,
        exportedAt: new Date().toISOString(),
        records: recordRows.map(serializeRecord),
        habits: habitRows,
        habitCompletions: completionRows,
        tasks: taskRows,
        goals: goalRows,
        focusSessions: focusRows,
        pointActivities: activityRows,
        pointTransactions: pointRows,
        auditLogs: auditRows,
        rewards: rewardRows,
        rewardRedemptions: redemptionRows,
        settings: settingsRows[0] ?? null,
        exerciseLibrary: libraryRows,
        trainingPlans: planRows,
        trainingExercises: exerciseRows,
        trainingSessions: sessionRows,
        trainingSets: setRows,
      };
    }),
    importRecords: protectedProcedure.input(backupPayloadSchema).mutation(async ({ ctx, input }) => {
      const payload = backupPayloadSchema.parse(input);
      if (payload.version >= 2) assertBackupRelationships(payload);
      const db = await requireDb();
      const userId = ctx.user.id;
      const text = (row: Record<string, unknown>, key: string, label: string, fallback = "") => optionalString(row, key) ?? fallback;
      const number = (row: Record<string, unknown>, key: string, fallback = 0) => optionalNumber(row, key) ?? fallback;
      const date = (row: Record<string, unknown>, key: string, label: string, dateOnly = false) => row[key] == null ? null : asDate(row[key], `${label}.${key}`, dateOnly);
      const bool = (row: Record<string, unknown>, key: string, fallback = false) => typeof row[key] === "boolean" ? row[key] as boolean : fallback;
      const enumValue = <T extends string>(row: Record<string, unknown>, key: string, values: readonly T[], fallback: T) => typeof row[key] === "string" && values.includes(row[key] as T) ? row[key] as T : fallback;
      const details = (value: unknown) => {
        if (value && typeof value === "object" && !Array.isArray(value)) return JSON.stringify(value);
        if (typeof value === "string") { try { const parsed = JSON.parse(value); return JSON.stringify(parsed && typeof parsed === "object" ? parsed : {}); } catch { return "{}"; } }
        return "{}";
      };
      const count = { records: 0, habits: 0, habitCompletions: 0, tasks: 0, goals: 0, focusSessions: 0, pointActivities: 0, pointTransactions: 0, auditLogs: 0, rewards: 0, rewardRedemptions: 0, settings: 0, exerciseLibrary: 0, trainingPlans: 0, trainingExercises: 0, trainingSessions: 0, trainingSets: 0 };
      const maps = { habits: new Map<number, number>(), goals: new Map<number, number>(), library: new Map<number, number>(), plans: new Map<number, number>(), exercises: new Map<number, number>(), sessions: new Map<number, number>(), tasks: new Map<number, number>(), records: new Map<number, number>(), pointActivities: new Map<number, number>(), pointTransactions: new Map<number, number>(), rewards: new Map<number, number>() };

      await db.transaction(async tx => {
        for (const row of payload.records) {
          const oldId = rowId(row, "Registro");
          const result = await tx.insert(moduleRecords).values({ userId, module: text(row, "module", "Registro"), title: requiredString(row, "title", "Registro"), subtitle: optionalString(row, "subtitle"), status: text(row, "status", "Registro", "active"), numericValue: number(row, "numericValue"), amountCents: number(row, "amountCents"), recordDate: date(row, "recordDate", "Registro", true), details: details(row.details) });
          maps.records.set(oldId, Number(result[0].insertId)); count.records += 1;
        }
        for (const row of payload.habits) {
          const oldId = rowId(row, "Hábito");
          const result = await tx.insert(habits).values({ userId, name: requiredString(row, "name", "Hábito"), category: text(row, "category", "Hábito", "Disciplina"), isCorrosive: bool(row, "isCorrosive"), frequency: enumValue(row, "frequency", ["daily", "weekly", "custom"] as const, "daily"), active: bool(row, "active", true) });
          maps.habits.set(oldId, Number(result[0].insertId)); count.habits += 1;
        }
        for (const row of payload.goals) {
          const oldId = rowId(row, "Meta");
          const automationType = enumValue(row, "automationType", ["manual", "habit", "tasks", "focus", "training", "nutrition"] as const, "manual");
          const oldRef = optionalNumber(row, "automationRefId");
          const result = await tx.insert(goals).values({ userId, title: requiredString(row, "title", "Meta"), category: text(row, "category", "Meta", "Pessoal"), progress: number(row, "progress"), target: Math.max(1, number(row, "target", 100)), deadline: date(row, "deadline", "Meta", true), automationType, automationRefId: automationType === "habit" && oldRef !== null ? maps.habits.get(oldRef) ?? null : oldRef, automationStartDate: date(row, "automationStartDate", "Meta", true), status: enumValue(row, "status", ["active", "completed", "paused"] as const, "active") });
          maps.goals.set(oldId, Number(result[0].insertId)); count.goals += 1;
        }
        for (const row of payload.tasks) {
          const oldId = rowId(row, "Tarefa");
          const oldGoal = optionalNumber(row, "goalId");
          const result = await tx.insert(tasks).values({ userId, title: requiredString(row, "title", "Tarefa"), description: optionalString(row, "description"), category: text(row, "category", "Tarefa", "Geral"), isCorrosive: bool(row, "isCorrosive"), priority: enumValue(row, "priority", ["low", "medium", "high"] as const, "medium"), status: enumValue(row, "status", ["todo", "in_progress", "completed"] as const, "todo"), dueDate: date(row, "dueDate", "Tarefa", true), goalId: oldGoal === null ? null : maps.goals.get(oldGoal) ?? null });
          maps.tasks.set(oldId, Number(result[0].insertId)); count.tasks += 1;
        }
        for (const row of payload.rewards) {
          const oldId = rowId(row, "Recompensa");
          const result = await tx.insert(rewards).values({ userId, title: requiredString(row, "title", "Recompensa"), description: optionalString(row, "description"), category: text(row, "category", "Recompensa", "Lazer"), imageUrl: optionalString(row, "imageUrl"), costPoints: Math.max(0, number(row, "costPoints")), status: enumValue(row, "status", ["active", "archived"] as const, "active") });
          maps.rewards.set(oldId, Number(result[0].insertId)); count.rewards += 1;
        }
        for (const row of payload.habitCompletions) {
          const habitId = maps.habits.get(requiredNumber(row, "habitId", "Conclusão de hábito"));
          if (!habitId) throw new Error("Não foi possível remapear uma conclusão de hábito.");
          await tx.insert(habitCompletions).values({ userId, habitId, day: asDate(row.day, "Conclusão de hábito.day", true), status: enumValue(row, "status", ["completed", "dismissed", "missed"] as const, "completed"), note: optionalString(row, "note") }); count.habitCompletions += 1;
        }
        for (const row of payload.pointActivities) {
          const sourceType = text(row, "sourceType", "Atividade pontuável");
          const oldSourceId = requiredNumber(row, "sourceId", "Atividade pontuável");
          const sourceId = sourceType === "habit" ? maps.habits.get(oldSourceId) : sourceType === "task" ? maps.tasks.get(oldSourceId) : oldSourceId;
          if (!sourceId) throw new Error("Não foi possível remapear a origem de uma atividade pontuável.");
          const oldId = rowId(row, "Atividade pontuável");
          const result = await tx.insert(pointActivities).values({ userId, sourceType, sourceId, occurrenceDate: asDate(row.occurrenceDate, "Atividade pontuável.occurrenceDate", true), category: text(row, "category", "Atividade pontuável", "Outros"), basePoints: number(row, "basePoints", 4), isCorrosive: bool(row, "isCorrosive"), status: enumValue(row, "status", ["completed", "missed"] as const, "missed"), version: Math.max(1, number(row, "version", 1)) });
          maps.pointActivities.set(oldId, Number(result[0].insertId)); count.pointActivities += 1;
        }
        for (const row of payload.focusSessions) {
          await tx.insert(focusSessions).values({ userId, durationMinutes: Math.max(1, number(row, "durationMinutes", 1)), startedAt: asDate(row.startedAt, "Sessão de foco.startedAt"), endedAt: asDate(row.endedAt, "Sessão de foco.endedAt") }); count.focusSessions += 1;
        }
        for (const row of payload.exerciseLibrary) {
          const oldId = rowId(row, "Exercício da biblioteca");
          const result = await tx.insert(exerciseLibrary).values({ userId, name: requiredString(row, "name", "Exercício da biblioteca"), muscleGroup: requiredString(row, "muscleGroup", "Exercício da biblioteca"), description: optionalString(row, "description"), equipment: optionalString(row, "equipment"), demonstrationUrl: optionalString(row, "demonstrationUrl") });
          maps.library.set(oldId, Number(result[0].insertId)); count.exerciseLibrary += 1;
        }
        for (const row of payload.trainingPlans) {
          const oldId = rowId(row, "Ficha");
          const result = await tx.insert(trainingPlans).values({ userId, name: requiredString(row, "name", "Ficha"), category: text(row, "category", "Ficha", "Musculação"), modality: text(row, "modality", "Ficha", "musculacao"), weekdays: text(row, "weekdays", "Ficha"), active: bool(row, "active", true) });
          maps.plans.set(oldId, Number(result[0].insertId)); count.trainingPlans += 1;
        }
        for (const row of payload.trainingExercises) {
          const oldPlan = requiredNumber(row, "planId", "Exercício");
          const planId = maps.plans.get(oldPlan);
          if (!planId) throw new Error("Não foi possível remapear uma ficha de treino.");
          const oldId = rowId(row, "Exercício");
          const oldLibrary = optionalNumber(row, "libraryId");
          const result = await tx.insert(trainingExercises).values({ userId, planId, libraryId: oldLibrary === null ? null : maps.library.get(oldLibrary) ?? null, name: requiredString(row, "name", "Exercício"), muscleGroup: requiredString(row, "muscleGroup", "Exercício"), equipment: optionalString(row, "equipment"), description: optionalString(row, "description"), sortOrder: number(row, "sortOrder"), plannedSets: Math.max(1, number(row, "plannedSets", 3)), plannedReps: Math.max(1, number(row, "plannedReps", 10)), plannedWeightKg: Math.max(0, number(row, "plannedWeightKg")), restSeconds: Math.max(0, number(row, "restSeconds", 90)) });
          maps.exercises.set(oldId, Number(result[0].insertId)); count.trainingExercises += 1;
        }
        for (const row of payload.trainingSessions) {
          const planId = maps.plans.get(requiredNumber(row, "planId", "Sessão"));
          if (!planId) throw new Error("Não foi possível remapear uma ficha da sessão.");
          const oldId = rowId(row, "Sessão");
          const result = await tx.insert(trainingSessions).values({ userId, planId, sessionDate: asDate(row.sessionDate, "Sessão.sessionDate", true), startedAt: asDate(row.startedAt, "Sessão.startedAt"), endedAt: date(row, "endedAt", "Sessão"), status: text(row, "status", "Sessão", "in_progress"), notes: optionalString(row, "notes") });
          maps.sessions.set(oldId, Number(result[0].insertId)); count.trainingSessions += 1;
        }
        for (const row of payload.trainingSets) {
          const sessionId = maps.sessions.get(requiredNumber(row, "sessionId", "Série"));
          const exerciseId = maps.exercises.get(requiredNumber(row, "exerciseId", "Série"));
          if (!sessionId || !exerciseId) throw new Error("Não foi possível remapear uma série de treino.");
          await tx.insert(trainingSets).values({ userId, sessionId, exerciseId, setNumber: Math.max(1, number(row, "setNumber", 1)), plannedReps: Math.max(1, number(row, "plannedReps", 1)), plannedWeightKg: Math.max(0, number(row, "plannedWeightKg")), actualReps: Math.max(0, number(row, "actualReps")), actualWeightKg: Math.max(0, number(row, "actualWeightKg")), completed: bool(row, "completed"), completedAt: date(row, "completedAt", "Série" ) }); count.trainingSets += 1;
        }
        for (const row of payload.pointTransactions) {
          const reason = requiredString(row, "reason", "Pontuação");
          const oldRef = optionalNumber(row, "referenceId");
          const referenceId = remapPointReference(reason, oldRef, maps);
          const oldActivityId = optionalNumber(row, "activityId");
          const inserted = await tx.insert(pointTransactions).values({ userId, points: requiredNumber(row, "points", "Pontuação"), reason, referenceId, activityId: oldActivityId === null ? null : maps.pointActivities.get(oldActivityId) ?? null, category: text(row, "category", "Pontuação", "Outros"), movementType: enumValue(row, "movementType", ["legacy", "earned", "missed", "corrosive_missed", "redemption", "adjustment"] as const, "legacy"), sourceType: optionalString(row, "sourceType"), sourceId: optionalNumber(row, "sourceId"), occurrenceDate: date(row, "occurrenceDate", "Pontuação", true), idempotencyKey: optionalString(row, "idempotencyKey") });
          maps.pointTransactions.set(rowId(row, "Pontuação"), Number(inserted[0].insertId)); count.pointTransactions += 1;
        }
        for (const row of payload.rewardRedemptions) {
          const rewardId = maps.rewards.get(requiredNumber(row, "rewardId", "Resgate"));
          const pointTransactionId = maps.pointTransactions.get(requiredNumber(row, "pointTransactionId", "Resgate"));
          if (!rewardId || !pointTransactionId) throw new Error("Não foi possível remapear um resgate de recompensa.");
          await tx.insert(rewardRedemptions).values({ userId, rewardId, costPoints: Math.max(0, number(row, "costPoints")), pointTransactionId, redeemedAt: date(row, "redeemedAt", "Resgate") ?? new Date() }); count.rewardRedemptions += 1;
        }
        for (const row of payload.auditLogs) {
          const entity = requiredString(row, "entity", "Log de auditoria");
          const oldEntityId = optionalNumber(row, "entityId");
          const mapping = entity === "treinos" ? maps.sessions : entity === "tasks" ? maps.tasks : entity === "module_records" ? maps.records : entity === "habits" ? maps.habits : entity === "goals" ? maps.goals : null;
          await tx.insert(auditLogs).values({ userId, action: requiredString(row, "action", "Log de auditoria"), entity, entityId: oldEntityId !== null && mapping ? mapping.get(oldEntityId) ?? null : null, beforeData: optionalString(row, "beforeData"), afterData: optionalString(row, "afterData") }); count.auditLogs += 1;
        }
        if (payload.settings) {
          const current = await tx.select({ id: userSettings.id }).from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
          if (!current[0]) {
            const row = payload.settings;
            await tx.insert(userSettings).values({ userId, goals: optionalString(row, "goals"), notifications: bool(row, "notifications", true), preferredFocusMinutes: Math.min(120, Math.max(1, number(row, "preferredFocusMinutes", 25))), preferredBreakMinutes: Math.min(60, Math.max(1, number(row, "preferredBreakMinutes", 5))) }); count.settings = 1;
          }
        }
      });
      return { success: true, imported: count.records, counts: count, message: "Backup validado e mesclado sem sobrescrever dados existentes." } as const;
    }),
  }),

  settings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const rows = await db.select().from(userSettings).where(eq(userSettings.userId, ctx.user.id)).limit(1);
      return rows[0] ?? { notifications: true, preferredFocusMinutes: 25, preferredBreakMinutes: 5, goals: null };
    }),
    update: protectedProcedure.input(z.object({ notifications: z.boolean(), preferredFocusMinutes: z.number().int().min(1).max(120), preferredBreakMinutes: z.number().int().min(1).max(60), goals: z.string().max(2000).nullable() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const existing = await db.select({ id: userSettings.id }).from(userSettings).where(eq(userSettings.userId, ctx.user.id)).limit(1);
      if (existing[0]) await db.update(userSettings).set(input).where(eq(userSettings.id, existing[0].id));
      else await db.insert(userSettings).values({ userId: ctx.user.id, ...input });
      return { success: true } as const;
    }),
  }),

  focus: router({
    sessions: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select().from(focusSessions).where(eq(focusSessions.userId, ctx.user.id)).orderBy(desc(focusSessions.createdAt)).limit(30);
    }),
    log: protectedProcedure.input(z.object({ durationMinutes: z.number().int().min(1).max(1440), startedAt: z.string().datetime(), endedAt: z.string().datetime() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.insert(focusSessions).values({ userId: ctx.user.id, durationMinutes: input.durationMinutes, startedAt: new Date(input.startedAt), endedAt: new Date(input.endedAt) });
      return { success: true } as const;
    }),
  }),
});

export type AppRouter = typeof appRouter;

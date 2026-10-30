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
  pointTransactions,
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
  "Alimentação": 8,
  "Trabalho": 7,
  "Estudos": 6,
  "Financeiro": 6,
  "Físico": 5,
  "Saúde": 5,
  "Desenvolvimento pessoal": 5,
  "Hábitos": 4,
  "Mente": 4,
  "Relacionamentos": 4,
  "Outros": 3,
  "Geral": 3,
};
function pointsForCategory(category: string | null | undefined) { return CATEGORY_POINTS[category ?? "Geral"] ?? 3; }
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

const habitInput = z.object({
  name: z.string().trim().min(2).max(160),
  category: z.string().trim().max(80).optional(),
  frequency: z.enum(["daily", "weekly", "custom"]).default("daily"),
});

const taskInput = z.object({
  title: z.string().trim().min(2).max(200),
  category: z.string().trim().max(80).optional(),
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
          const day = cursor.toISOString().slice(0, 10); if (day < created) continue;
          if (completedHabitDays.has(`${habit.id}:${day}`)) habitDone += POINTS.habitDone;
          else if (missedHabitDays.has(`${habit.id}:${day}`) || day < input.today) habitMissed += POINTS.habitMissed;
        }
      }
      const completedTasks = taskRows.filter(task => task.status === "completed" && dateKey(task.updatedAt) >= start && dateKey(task.updatedAt) <= input.today);
      const overdueTasks = taskRows.filter(task => task.status !== "completed" && task.dueDate && dateKey(task.dueDate) >= start && dateKey(task.dueDate) < input.today);
      const completedTaskPoints = completedTasks.reduce((sum, task) => sum + pointsForCategory(task.category), 0);
      const habitEvents = completionRows.filter(row => row.status === "completed" && dateKey(row.day) >= start && dateKey(row.day) <= input.today).map(row => ({ day: dateKey(row.day), category: habitRows.find(habit => habit.id === row.habitId)?.category ?? "Hábitos", points: POINTS.habitDone }));
      const taskEvents = completedTasks.map(task => ({ day: dateKey(task.updatedAt), category: task.category, points: pointsForCategory(task.category) }));
      const dedupeKeys = new Set<string>();
      let dedupedEarned = 0;
      for (const event of [...habitEvents, ...taskEvents]) {
        const key = `${event.day}:${event.category}`;
        if (dedupeKeys.has(key)) continue;
        dedupeKeys.add(key);
        const sameDayActions = [...habitEvents, ...taskEvents].filter(item => item.day === event.day && item.category === event.category);
        dedupedEarned += Math.max(...sameDayActions.map(item => item.points));
      }
      const taskLost = overdueTasks.reduce((sum, task) => sum + overdueLoss(task.category), 0);
      const goalEarned = goalRows.filter(goal => goal.status === "completed" && dateKey(goal.updatedAt) >= start && dateKey(goal.updatedAt) <= input.today).length * POINTS.goalDone;
      const focusEarned = Math.min(5, Math.floor(focusRows.filter(session => dateKey(session.createdAt) >= start && dateKey(session.createdAt) <= input.today).reduce((sum, session) => sum + session.durationMinutes, 0) / 25)) * POINTS.focusBlock;
      const earned = Math.max(0, dedupedEarned + goalEarned + focusEarned);
      const lost = Math.abs(habitMissed + taskLost);
      const spent = spendingRows.reduce((sum, row) => sum + Math.max(0, row.points), 0);
      const net = earned - lost;
      const walletBalance = Math.max(0, net - spent);
      const obligations = habitRows.filter(row => row.active && row.frequency === "daily").length * Math.max(0, Math.floor((new Date(`${input.today}T12:00:00Z`).getTime() - new Date(`${start}T12:00:00Z`).getTime()) / 86400000) + 1) + taskRows.filter(task => (task.dueDate && dateKey(task.dueDate) >= start && dateKey(task.dueDate) <= input.today) || task.status === "completed").length;
      const completedObligations = completedHabitDays.size + completedTasks.length;
      return { start, today: input.today, earned, lost, net, spent, walletBalance, completionRate: obligations ? Math.round((completedObligations / obligations) * 100) : 0, breakdown: { habits: habitDone + habitMissed, tasks: completedTaskPoints + taskLost, goals: goalEarned, focus: focusEarned, overdueTasks: overdueTasks.length }, rules: { habitDone: POINTS.habitDone, categoryPoints: CATEGORY_POINTS, overdueFormula: "metade dos pontos da categoria, mínimo de 2", goalDone: POINTS.goalDone, focusBlock: POINTS.focusBlock, deduplication: "no mesmo dia e categoria, vale somente a maior ação" } };
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
        frequency: input.frequency,
      });
      return { success: true } as const;
    }),
    update: protectedProcedure.input(habitInput.extend({ habitId: idSchema, active: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.update(habits).set({ name: input.name, category: input.category || "Disciplina", frequency: input.frequency, active: input.active ?? true }).where(and(eq(habits.id, input.habitId), eq(habits.userId, ctx.user.id)));
      return { success: true } as const;
    }),
    toggleToday: protectedProcedure.input(z.object({ habitId: idSchema, day: daySchema, completed: z.boolean() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const ownHabit = await db.select({ id: habits.id }).from(habits).where(and(eq(habits.id, input.habitId), eq(habits.userId, ctx.user.id))).limit(1);
      if (!ownHabit[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Hábito não encontrado." });
      const day = new Date(`${input.day}T00:00:00.000Z`);
      const existing = await db.select().from(habitCompletions).where(and(eq(habitCompletions.habitId, input.habitId), eq(habitCompletions.userId, ctx.user.id), eq(habitCompletions.day, day))).limit(1);
      if (existing[0]) {
        await db.update(habitCompletions).set({ status: input.completed ? "completed" : "missed" }).where(eq(habitCompletions.id, existing[0].id));
      } else if (input.completed) {
        await db.insert(habitCompletions).values({ userId: ctx.user.id, habitId: input.habitId, day, status: "completed" });
      }
      return { success: true } as const;
    }),
    delete: protectedProcedure.input(z.object({ habitId: idSchema })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
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
      await db.insert(tasks).values({ userId: ctx.user.id, title: input.title, category: input.category || "Geral", priority: "medium", dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null, goalId: input.goalId ?? null });
      return { success: true } as const;
    }),
    update: protectedProcedure.input(taskInput.extend({ taskId: idSchema, status: z.enum(["todo", "in_progress", "completed"]).optional() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      if (input.goalId) {
        const ownGoal = await db.select({ id: goals.id }).from(goals).where(and(eq(goals.id, input.goalId), eq(goals.userId, ctx.user.id))).limit(1);
        if (!ownGoal[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "A meta selecionada não pertence à sua conta." });
      }
      await db.update(tasks).set({ title: input.title, category: input.category || "Geral", priority: "medium", dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null, goalId: input.goalId ?? null, status: input.status ?? "todo" }).where(and(eq(tasks.id, input.taskId), eq(tasks.userId, ctx.user.id)));
      return { success: true } as const;
    }),
    toggleComplete: protectedProcedure.input(z.object({ taskId: idSchema, completed: z.boolean(), today: daySchema.optional() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const ownTask = await db.select({ id: tasks.id, dueDate: tasks.dueDate, status: tasks.status }).from(tasks).where(and(eq(tasks.id, input.taskId), eq(tasks.userId, ctx.user.id))).limit(1);
      if (!ownTask[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Tarefa não encontrada." });
      const today = input.today ?? dateKey(new Date());
      if (input.completed && ownTask[0].dueDate && dateKey(ownTask[0].dueDate) < today) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "O prazo desta tarefa já terminou e ela foi considerada não concluída." });
      }
      await db.update(tasks).set({ status: input.completed ? "completed" : "todo" }).where(and(eq(tasks.id, input.taskId), eq(tasks.userId, ctx.user.id)));
      return { success: true } as const;
    }),
    delete: protectedProcedure.input(z.object({ taskId: idSchema })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.delete(tasks).where(and(eq(tasks.id, input.taskId), eq(tasks.userId, ctx.user.id)));
      return { success: true } as const;
    }),
  }),

  goals: router({
    create: protectedProcedure.input(goalInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const inserted = await db.insert(goals).values({ userId: ctx.user.id, title: input.title, category: input.category || "Pessoal", target: input.target, deadline: input.deadline ? new Date(`${input.deadline}T00:00:00.000Z`) : null, automationType: input.automationType, automationRefId: input.automationType === "habit" ? input.automationRefId ?? null : null, automationStartDate: input.automationType === "manual" ? null : new Date() });
      if (input.automationType === "tasks") await db.update(goals).set({ automationRefId: Number(inserted[0].insertId) }).where(and(eq(goals.id, Number(inserted[0].insertId)), eq(goals.userId, ctx.user.id)));
      return { success: true } as const;
    }),
    update: protectedProcedure.input(goalInput.extend({ goalId: idSchema, status: z.enum(["active", "completed", "paused"]).optional() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
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
      const point = await db.select({ id: pointTransactions.id }).from(pointTransactions).where(and(eq(pointTransactions.userId, ctx.user.id), eq(pointTransactions.referenceId, input.sessionId))).limit(1);
      if (!point[0]) await db.insert(pointTransactions).values({ userId: ctx.user.id, points: 5, reason: "Sessão de treino concluída", referenceId: input.sessionId });
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
      const [recordRows, habitRows, taskRows, goalRows, focusRows, settingsRows] = await Promise.all([
        db.select().from(moduleRecords).where(eq(moduleRecords.userId, ctx.user.id)),
        db.select().from(habits).where(eq(habits.userId, ctx.user.id)),
        db.select().from(tasks).where(eq(tasks.userId, ctx.user.id)),
        db.select().from(goals).where(eq(goals.userId, ctx.user.id)),
        db.select().from(focusSessions).where(eq(focusSessions.userId, ctx.user.id)),
        db.select().from(userSettings).where(eq(userSettings.userId, ctx.user.id)).limit(1),
      ]);
      return { version: 1, exportedAt: new Date().toISOString(), records: recordRows.map(serializeRecord), habits: habitRows, tasks: taskRows, goals: goalRows, focusSessions: focusRows, settings: settingsRows[0] ?? null };
    }),
    importRecords: protectedProcedure.input(z.object({ version: z.number().int().positive(), records: z.array(recordInput.omit({ module: true }).extend({ module: moduleSchema })).max(2000) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      for (const record of input.records) {
        await db.insert(moduleRecords).values({ userId: ctx.user.id, module: record.module, title: record.title, subtitle: record.subtitle || null, status: record.status, numericValue: record.numericValue, amountCents: record.amountCents, recordDate: record.recordDate ? new Date(`${record.recordDate}T00:00:00.000Z`) : null, details: JSON.stringify(record.details) });
      }
      return { success: true, imported: input.records.length } as const;
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

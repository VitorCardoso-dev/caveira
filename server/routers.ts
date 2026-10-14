import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  focusSessions,
  goals,
  habitCompletions,
  habits,
  tasks,
} from "../drizzle/schema";
import { getDb } from "./db";
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

const habitInput = z.object({
  name: z.string().trim().min(2).max(160),
  category: z.string().trim().max(80).optional(),
  frequency: z.enum(["daily", "weekly", "custom"]).default("daily"),
});

const taskInput = z.object({
  title: z.string().trim().min(2).max(200),
  category: z.string().trim().max(80).optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  dueDate: daySchema.nullable().optional(),
});

const goalInput = z.object({
  title: z.string().trim().min(2).max(200),
  category: z.string().trim().max(80).optional(),
  target: z.number().int().min(1).max(1000000).default(100),
  deadline: daySchema.nullable().optional(),
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

        const priority = { high: 0, medium: 1, low: 2 } as const;
        const openTasks = taskRows
          .filter(task => task.status !== "completed")
          .sort((a, b) => priority[a.priority] - priority[b.priority] || sortableDate(a.dueDate).localeCompare(sortableDate(b.dueDate)))
          .slice(0, 6);
        const completedTasks = taskRows.filter(task => task.status === "completed").length;
        const totalSignals = habitRows.length + taskRows.length;
        const completedSignals = todayCompleted.size + completedTasks;
        const score = totalSignals === 0 ? 0 : Math.min(100, Math.round((completedSignals / totalSignals) * 100));
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

        return {
          user: ctx.user,
          score,
          habits: habitSummary,
          tasks: openTasks,
          goals: goalRows.slice(0, 4),
          counts: {
            habits: habitRows.length,
            completedHabitsToday: todayCompleted.size,
            openTasks: taskRows.filter(task => task.status !== "completed").length,
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
      await db.delete(habitCompletions).where(and(eq(habitCompletions.habitId, input.habitId), eq(habitCompletions.userId, ctx.user.id)));
      await db.delete(habits).where(and(eq(habits.id, input.habitId), eq(habits.userId, ctx.user.id)));
      return { success: true } as const;
    }),
  }),

  tasks: router({
    create: protectedProcedure.input(taskInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.insert(tasks).values({ userId: ctx.user.id, title: input.title, category: input.category || "Geral", priority: input.priority, dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null });
      return { success: true } as const;
    }),
    toggleComplete: protectedProcedure.input(z.object({ taskId: idSchema, completed: z.boolean() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
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
      await db.insert(goals).values({ userId: ctx.user.id, title: input.title, category: input.category || "Pessoal", target: input.target, deadline: input.deadline ? new Date(`${input.deadline}T00:00:00.000Z`) : null });
      return { success: true } as const;
    }),
    updateProgress: protectedProcedure.input(z.object({ goalId: idSchema, progress: z.number().int().min(0).max(1000000) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.update(goals).set({ progress: input.progress, status: input.progress >= 100 ? "completed" : "active" }).where(and(eq(goals.id, input.goalId), eq(goals.userId, ctx.user.id)));
      return { success: true } as const;
    }),
    delete: protectedProcedure.input(z.object({ goalId: idSchema })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.delete(goals).where(and(eq(goals.id, input.goalId), eq(goals.userId, ctx.user.id)));
      return { success: true } as const;
    }),
  }),

  focus: router({
    log: protectedProcedure.input(z.object({ durationMinutes: z.number().int().min(1).max(1440), startedAt: z.string().datetime(), endedAt: z.string().datetime() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.insert(focusSessions).values({ userId: ctx.user.id, durationMinutes: input.durationMinutes, startedAt: new Date(input.startedAt), endedAt: new Date(input.endedAt) });
      return { success: true } as const;
    }),
  }),
});

export type AppRouter = typeof appRouter;

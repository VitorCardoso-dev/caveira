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
  tasks,
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
      await db.insert(tasks).values({ userId: ctx.user.id, title: input.title, category: input.category || "Geral", priority: input.priority, dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null });
      return { success: true } as const;
    }),
    update: protectedProcedure.input(taskInput.extend({ taskId: idSchema, status: z.enum(["todo", "in_progress", "completed"]).optional() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.update(tasks).set({ title: input.title, category: input.category || "Geral", priority: input.priority, dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null, status: input.status ?? "todo" }).where(and(eq(tasks.id, input.taskId), eq(tasks.userId, ctx.user.id)));
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
    update: protectedProcedure.input(goalInput.extend({ goalId: idSchema, status: z.enum(["active", "completed", "paused"]).optional() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.update(goals).set({ title: input.title, category: input.category || "Pessoal", target: input.target, deadline: input.deadline ? new Date(`${input.deadline}T00:00:00.000Z`) : null, status: input.status ?? "active" }).where(and(eq(goals.id, input.goalId), eq(goals.userId, ctx.user.id)));
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
      return {
        period: month,
        counts: { habits: habitRows.length, tasks: taskRows.length, completedTasks: taskRows.filter(task => task.status === "completed").length, goals: goalRows.length, focusSessions: focusRows.length, training: records.filter(record => record.module === "treinos").length },
        focusMinutes: focusRows.reduce((sum, session) => sum + session.durationMinutes, 0),
        finance: { income, expenses, balance: income - expenses },
        nutrition: { caloriesToday: nutrition },
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

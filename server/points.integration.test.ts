import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { focusSessions, goals, habitCompletions, habits, pointTransactions, rewards, tasks, users } from "../drizzle/schema";

const enabled = Boolean(process.env.DATABASE_URL);
describe.skipIf(!enabled)("points lifecycle integration (MySQL)", () => {
  let db: NonNullable<Awaited<ReturnType<typeof getDb>>>;
  const createdUsers: Array<{ id: number; openId: string; name: string | null; email: string | null; loginMethod: string | null; role: "user" | "admin"; createdAt: Date; updatedAt: Date; lastSignedIn: Date }> = [];

  async function createUser() {
    const openId = `points-integration-${randomUUID()}`;
    const inserted = await db.insert(users).values({ openId, name: "Points integration", email: null, loginMethod: "test", role: "user" });
    const rows = await db.select().from(users).where(eq(users.id, Number(inserted[0].insertId))).limit(1);
    if (!rows[0]) throw new Error("Não foi possível criar usuário de integração.");
    createdUsers.push(rows[0]);
    return rows[0];
  }

  function caller(user: (typeof createdUsers)[number]) {
    return appRouter.createCaller({ req: {} as never, res: {} as never, user });
  }

  beforeAll(async () => {
    const connection = await getDb();
    if (!connection) throw new Error("DATABASE_URL definido, mas o banco não conectou.");
    db = connection;
  });

  afterAll(async () => {
    if (db) await db.$client.end();
  });

  it("reconcilia hábito, ajuste, resgate, saldo negativo e isolamento por usuário", async () => {
    const owner = await createUser();
    const other = await createUser();
    const ownerCaller = caller(owner);
    const otherCaller = caller(other);

    await ownerCaller.habits.create({ name: "Hábito de integração", category: "Estudos", isCorrosive: false, frequency: "daily" });
    const habit = (await db.select().from(habits).where(eq(habits.userId, owner.id)).limit(1))[0];
    expect(habit).toBeDefined();

    const today = new Date().toISOString().slice(0, 10);
    await ownerCaller.habits.toggleToday({ habitId: habit.id, day: today, completed: true });
    await ownerCaller.habits.toggleToday({ habitId: habit.id, day: today, completed: true });
    await ownerCaller.habits.toggleToday({ habitId: habit.id, day: today, completed: false });

    const reward = await ownerCaller.rewards.create({ title: "Recompensa acima do saldo", description: "Teste de saldo negativo", category: "Lazer", costPoints: 15 });
    const redemptionKey = `points-integration:${randomUUID()}`;
    const firstRedeem = await ownerCaller.rewards.redeem({ rewardId: reward.id, idempotencyKey: redemptionKey });
    const retryRedeem = await ownerCaller.rewards.redeem({ rewardId: reward.id, idempotencyKey: redemptionKey });

    expect(firstRedeem).toEqual({ success: true, duplicate: false });
    expect(retryRedeem).toEqual({ success: true, duplicate: true });

    const movements = await db.select().from(pointTransactions).where(eq(pointTransactions.userId, owner.id));
    const nonZeroMovements = movements.filter(row => row.points !== 0);
    expect(nonZeroMovements).toHaveLength(3);
    expect(nonZeroMovements.reduce((sum, row) => sum + row.points, 0)).toBe(-20);
    expect(nonZeroMovements.filter(row => row.movementType === "earned")).toHaveLength(1);
    expect(nonZeroMovements.filter(row => row.movementType === "adjustment")).toHaveLength(1);
    expect(nonZeroMovements.filter(row => row.movementType === "redemption")).toHaveLength(1);
    const weekly = await ownerCaller.points.weekly({ today });
    expect(weekly.walletBalance).toBe(-20);
    expect(weekly.earned).toBe(10);
    expect(weekly.lost).toBe(15);
    expect(weekly.spent).toBe(15);
    expect(weekly.net).toBe(-20);

    const history = await ownerCaller.points.history({ limit: 10 });
    expect(history.items).toHaveLength(3);
    expect((await otherCaller.points.history({ limit: 10 })).items).toHaveLength(0);

    const ownReward = await db.select().from(rewards).where(eq(rewards.userId, owner.id));
    const otherReward = await db.select().from(rewards).where(eq(rewards.userId, other.id));
    expect(ownReward).toHaveLength(1);
    expect(otherReward).toHaveLength(0);
  });
  it("migra o saldo legado uma única vez e o soma ao ledger novo", async () => {
    const owner = await createUser();
    const legacyDate = new Date("2026-10-26T12:00:00.000Z");
    const insertedHabit = await db.insert(habits).values({
      userId: owner.id, name: "Hábito legado", category: "Estudos", isCorrosive: false,
      frequency: "daily", active: true, createdAt: legacyDate,
    });
    const habitId = Number(insertedHabit[0].insertId);
    await db.insert(habitCompletions).values({
      userId: owner.id, habitId, day: new Date("2026-10-26T00:00:00.000Z"), status: "completed",
    });
    await db.insert(tasks).values({
      userId: owner.id, title: "Tarefa vencida legada", category: "Estudos", isCorrosive: false,
      priority: "medium", status: "todo", dueDate: new Date("2026-10-28T00:00:00.000Z"), createdAt: legacyDate,
    });
    await db.insert(goals).values({
      userId: owner.id, title: "Meta legada concluída", category: "Estudos", progress: 100, target: 100,
      automationType: "manual", status: "completed", createdAt: legacyDate,
      updatedAt: new Date("2026-10-27T12:00:00.000Z"),
    });
    await db.insert(focusSessions).values({
      userId: owner.id, durationMinutes: 50, startedAt: legacyDate,
      endedAt: new Date("2026-10-26T12:50:00.000Z"), createdAt: legacyDate,
    });
    await db.insert(pointTransactions).values({
      userId: owner.id, points: 3, reason: "Resgate legado", category: "Outros",
      movementType: "legacy", occurrenceDate: null,
    });

    const weekly = await caller(owner).points.weekly({ today: "2026-10-30" });
    expect(weekly.walletBalance).toBe(3);
    expect(weekly.earned).toBe(12);
    expect(weekly.lost).toBe(6);
    expect(weekly.spent).toBe(0);

    const openingRows = await db.select().from(pointTransactions).where(eq(pointTransactions.userId, owner.id));
    expect(openingRows.filter(row => row.idempotencyKey === "legacy-opening-balance:v1")).toHaveLength(1);
    expect(openingRows.find(row => row.idempotencyKey === "legacy-opening-balance:v1")?.points).toBe(6);
    await caller(owner).points.weekly({ today: "2026-10-30" });
    const retriedRows = await db.select().from(pointTransactions).where(eq(pointTransactions.userId, owner.id));
    expect(retriedRows.filter(row => row.idempotencyKey === "legacy-opening-balance:v1")).toHaveLength(1);
    const history = await caller(owner).points.history({ limit: 10 });
    expect(history.items.map(row => row.points)).toContain(-3);
    expect(history.items.map(row => row.points)).toContain(6);
  });
});

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { backupImports, moduleRecords, pointTransactions, users } from "../drizzle/schema";

const enabled = Boolean(process.env.DATABASE_URL);
const suite = describe.skipIf(!enabled)("backup integration (MySQL)", () => {
  const createdUsers: Array<Awaited<ReturnType<typeof createUser>>> = [];
  let db: NonNullable<Awaited<ReturnType<typeof getDb>>>;

  async function createUser() {
    const openId = `backup-integration-${randomUUID()}`;
    const inserted = await db.insert(users).values({ openId, name: "Backup integration", email: null, loginMethod: "test", role: "user" });
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

  it("exporta, restaura relações, evita reimportar o mesmo arquivo e isola contas", async () => {
    const source = await createUser();
    const destination = await createUser();
    const otherDestination = await createUser();
    const seed = {
      version: 3,
      exportId: randomUUID(),
      exportedAt: new Date().toISOString(),
      records: [{ id: 50, module: "financas", title: "Conta teste", status: "active", numericValue: 0, amountCents: 1250, recordDate: "2026-11-01", details: { type: "expense" } }],
      habits: [{ id: 1, name: "Hábito de integração", category: "Estudos", isCorrosive: false, frequency: "daily", active: true }],
      habitCompletions: [{ id: 2, habitId: 1, day: "2026-11-01", status: "completed" }],
      goals: [{ id: 3, title: "Meta integrada", category: "Estudos", progress: 1, target: 5, automationType: "habit", automationRefId: 1, status: "active" }],
      goalSources: [{ id: 4, goalId: 3, sourceType: "habit", sourceId: 1, weightPercent: 100 }],
      tasks: [{ id: 5, title: "Tarefa integrada", category: "Estudos", isCorrosive: false, priority: "medium", status: "completed", goalId: 3 }],
      pointActivities: [{ id: 6, sourceType: "habit", sourceId: 1, occurrenceDate: "2026-11-01", category: "Estudos", basePoints: 10, isCorrosive: false, status: "completed", version: 1 }],
      pointTransactions: [{ id: 7, points: 10, reason: "Hábito cumprido", activityId: 6, category: "Estudos", movementType: "earned", sourceType: "habit", sourceId: 1, referenceId: 1, occurrenceDate: "2026-11-01", idempotencyKey: "backup-integration:habit:1" }],
      trainingPlans: [{ id: 8, name: "Ficha teste", category: "Força", modality: "musculacao", weekdays: "1,3,5", active: true }],
      trainingExercises: [{ id: 9, planId: 8, name: "Agachamento", muscleGroup: "Pernas", sortOrder: 0, plannedSets: 1, plannedReps: 10, plannedWeightKg: 20, restSeconds: 90 }],
      trainingSessions: [{ id: 10, planId: 8, sessionDate: "2026-11-01", startedAt: "2026-11-01T10:00:00.000Z", status: "completed" }],
      trainingSets: [{ id: 11, sessionId: 10, exerciseId: 9, setNumber: 1, plannedReps: 10, plannedWeightKg: 20, actualReps: 10, actualWeightKg: 20, completed: true }],
    };

    await caller(source).backup.importRecords(seed);
    const backup = await caller(source).backup.export();
    const firstRestore = await caller(destination).backup.importRecords(backup);
    const duplicateRestore = await caller(destination).backup.importRecords(backup);
    const independentRestore = await caller(otherDestination).backup.importRecords(backup);

    expect(firstRestore.duplicate).toBe(false);
    expect(firstRestore.imported).toBeGreaterThan(0);
    expect(duplicateRestore.duplicate).toBe(true);
    expect(duplicateRestore.imported).toBe(0);
    expect(independentRestore.duplicate).toBe(false);

    const restored = await caller(destination).backup.export();
    expect(restored.records).toHaveLength(1);
    expect(restored.habits).toHaveLength(1);
    expect(restored.habitCompletions[0].habitId).toBe(restored.habits[0].id);
    expect(restored.goalSources[0].goalId).toBe(restored.goals[0].id);
    expect(restored.tasks[0].goalId).toBe(restored.goals[0].id);
    expect(restored.pointActivities[0].sourceId).toBe(restored.habits[0].id);
    expect(restored.pointTransactions[0].activityId).toBe(restored.pointActivities[0].id);
    expect(restored.pointTransactions[0].sourceId).toBe(restored.habits[0].id);
    expect(restored.trainingSets[0].sessionId).toBe(restored.trainingSessions[0].id);
    expect(restored.trainingSets[0].exerciseId).toBe(restored.trainingExercises[0].id);
    expect(restored.records[0].userId).toBe(destination.id);

    const otherBackup = await caller(otherDestination).backup.export();
    expect(otherBackup.records).toHaveLength(1);
    expect(otherBackup.records[0].userId).toBe(otherDestination.id);
  });

  it("reverte a restauração inteira quando uma gravação falha", async () => {
    const destination = await createUser();
    await db.insert(pointTransactions).values({ userId: destination.id, points: 1, reason: "Chave reservada", movementType: "earned", idempotencyKey: "backup-rollback:collision" });
    const exportId = randomUUID();
    const invalidAtWrite = {
      version: 3,
      exportId,
      records: [{ id: 1, module: "financas", title: "Não deve persistir", status: "active", numericValue: 0, amountCents: 500, details: {} }],
      pointTransactions: [{ id: 2, points: 5, reason: "Colisão", movementType: "earned", idempotencyKey: "backup-rollback:collision" }],
    };

    await expect(caller(destination).backup.importRecords(invalidAtWrite)).rejects.toThrow();
    const rows = await db.select().from(moduleRecords).where(and(eq(moduleRecords.userId, destination.id), eq(moduleRecords.title, "Não deve persistir")));
    const marker = await db.select().from(backupImports).where(and(eq(backupImports.userId, destination.id), eq(backupImports.exportId, exportId)));
    expect(rows).toHaveLength(0);
    expect(marker).toHaveLength(0);
  });
});

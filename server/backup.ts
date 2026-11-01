import { z } from "zod";

const backupDate = z.union([z.string().min(1), z.date()]).nullable().optional();
const backupRow = z.record(z.string(), z.unknown());

export const backupPayloadSchema = z.object({
  version: z.number().int().min(1).max(3),
  exportId: z.string().uuid().optional(),
  exportedAt: z.string().optional(),
  records: z.array(backupRow).max(5000).default([]),
  habits: z.array(backupRow).max(1000).default([]),
  habitCompletions: z.array(backupRow).max(10000).default([]),
  tasks: z.array(backupRow).max(5000).default([]),
  goals: z.array(backupRow).max(5000).default([]),
  goalSources: z.array(backupRow).max(20000).default([]),
  focusSessions: z.array(backupRow).max(5000).default([]),
  pointTransactions: z.array(backupRow).max(10000).default([]),
  pointActivities: z.array(backupRow).max(20000).default([]),
  auditLogs: z.array(backupRow).max(20000).default([]),
  rewards: z.array(backupRow).max(5000).default([]),
  rewardRedemptions: z.array(backupRow).max(20000).default([]),
  settings: backupRow.nullable().default(null),
  exerciseLibrary: z.array(backupRow).max(5000).default([]),
  trainingPlans: z.array(backupRow).max(1000).default([]),
  trainingExercises: z.array(backupRow).max(10000).default([]),
  trainingSessions: z.array(backupRow).max(5000).default([]),
  trainingSets: z.array(backupRow).max(50000).default([]),
}).passthrough().superRefine((payload, context) => {
  if (payload.version >= 3 && !payload.exportId) context.addIssue({ code: "custom", path: ["exportId"], message: "Backup v3 precisa de um identificador de exportação." });
});

export type BackupPayload = z.infer<typeof backupPayloadSchema>;

export function rowId(row: Record<string, unknown>, label: string) {
  const value = row.id;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) throw new Error(`${label} possui um id inválido.`);
  return value;
}

export function requiredNumber(row: Record<string, unknown>, key: string, label: string) {
  const value = row[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} possui ${key} inválido.`);
  return value;
}

export function optionalNumber(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function requiredString(row: Record<string, unknown>, key: string, label: string) {
  const value = row[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} possui ${key} inválido.`);
  return value;
}

export function optionalString(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export function asDate(value: unknown, label: string, dateOnly = false) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error(`${label} possui data inválida.`);
    return value;
  }
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} possui data inválida.`);
  const parsed = dateOnly ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${label} possui data inválida.`);
  return parsed;
}

export function assertBackupRelationships(payload: BackupPayload) {
  const habitIds = new Set(payload.habits.map(row => rowId(row, "Hábito")));
  const goalIds = new Set(payload.goals.map(row => rowId(row, "Meta")));
  const goalWeights = new Map<number, number>();
  for (const row of payload.goalSources) {
    const goalId = requiredNumber(row, "goalId", "Fonte de meta");
    if (!goalIds.has(goalId)) throw new Error("A fonte de meta aponta para uma meta inexistente.");
    const weight = requiredNumber(row, "weightPercent", "Fonte de meta");
    if (weight < 1 || weight > 100) throw new Error("A proporção da fonte de meta é inválida.");
    const sourceType = requiredString(row, "sourceType", "Fonte de meta");
    if (!["habit", "tasks", "focus", "training", "nutrition", "manual"].includes(sourceType)) throw new Error("A fonte de meta possui um tipo inválido.");
    const sourceId = optionalNumber(row, "sourceId");
    if (sourceType === "habit" && (sourceId === null || !habitIds.has(sourceId))) throw new Error("A fonte de meta aponta para um hábito inexistente.");
    if (sourceType !== "habit" && sourceId !== null) throw new Error("Somente fontes de hábito podem apontar para um registro específico.");
    goalWeights.set(goalId, (goalWeights.get(goalId) ?? 0) + weight);
  }
  for (const [goalId, weight] of goalWeights) if (weight !== 100) throw new Error(`As fontes da meta ${goalId} não somam 100%.`);
  const libraryIds = new Set(payload.exerciseLibrary.map(row => rowId(row, "Exercício da biblioteca")));
  const planIds = new Set(payload.trainingPlans.map(row => rowId(row, "Ficha")));
  const exerciseIds = new Set(payload.trainingExercises.map(row => rowId(row, "Exercício")));
  const sessionIds = new Set(payload.trainingSessions.map(row => rowId(row, "Sessão")));
  const pointActivityIds = new Set(payload.pointActivities.map(row => rowId(row, "Atividade pontuável")));
  const rewardIds = new Set(payload.rewards.map(row => rowId(row, "Recompensa")));
  const pointTransactionIds = new Set(payload.pointTransactions.map(row => rowId(row, "Pontuação")));

  for (const row of payload.habitCompletions) {
    if (!habitIds.has(requiredNumber(row, "habitId", "Conclusão de hábito"))) throw new Error("O backup contém uma conclusão ligada a um hábito inexistente.");
  }
  for (const row of payload.tasks) {
    const goalId = optionalNumber(row, "goalId");
    if (goalId !== null && !goalIds.has(goalId)) throw new Error("O backup contém uma tarefa ligada a uma meta inexistente.");
  }
  for (const row of payload.goals) {
    const refId = optionalNumber(row, "automationRefId");
    if (refId !== null && row.automationType === "habit" && !habitIds.has(refId)) throw new Error("O backup contém uma meta ligada a um hábito inexistente.");
  }
  for (const row of payload.pointActivities) {
    const sourceType = requiredString(row, "sourceType", "Atividade pontuável");
    const sourceId = requiredNumber(row, "sourceId", "Atividade pontuável");
    if (sourceType === "habit" && !habitIds.has(sourceId)) throw new Error("O backup contém uma atividade pontuável ligada a um hábito inexistente.");
    if (sourceType === "task" && !payload.tasks.some(task => rowId(task, "Tarefa") === sourceId)) throw new Error("O backup contém uma atividade pontuável ligada a uma tarefa inexistente.");
  }
  for (const row of payload.pointTransactions) {
    const activityId = optionalNumber(row, "activityId");
    if (activityId !== null && !pointActivityIds.has(activityId)) throw new Error("O backup contém uma transação ligada a uma atividade pontuável inexistente.");
  }
  for (const row of payload.rewardRedemptions) {
    if (!rewardIds.has(requiredNumber(row, "rewardId", "Resgate")) || !pointTransactionIds.has(requiredNumber(row, "pointTransactionId", "Resgate"))) throw new Error("O backup contém um resgate ligado a uma recompensa ou pontuação inexistente.");
  }
  for (const row of payload.trainingExercises) {
    if (!planIds.has(requiredNumber(row, "planId", "Exercício"))) throw new Error("O backup contém um exercício ligado a uma ficha inexistente.");
    const libraryId = optionalNumber(row, "libraryId");
    if (libraryId !== null && !libraryIds.has(libraryId)) throw new Error("O backup contém um exercício ligado a uma biblioteca inexistente.");
  }
  for (const row of payload.trainingSessions) {
    if (!planIds.has(requiredNumber(row, "planId", "Sessão"))) throw new Error("O backup contém uma sessão ligada a uma ficha inexistente.");
  }
  const planByExercise = new Map(payload.trainingExercises.map(row => [rowId(row, "Exercício"), requiredNumber(row, "planId", "Exercício")]));
  const planBySession = new Map(payload.trainingSessions.map(row => [rowId(row, "Sessão"), requiredNumber(row, "planId", "Sessão")]));
  for (const row of payload.trainingSets) {
    const sessionId = requiredNumber(row, "sessionId", "Série");
    const exerciseId = requiredNumber(row, "exerciseId", "Série");
    if (!sessionIds.has(sessionId) || !exerciseIds.has(exerciseId)) throw new Error("O backup contém uma série ligada a uma sessão ou exercício inexistente.");
    if (planBySession.get(sessionId) !== planByExercise.get(exerciseId)) throw new Error("O backup contém uma série cujo exercício não pertence à ficha da sessão.");
  }
}

export function remapPointReference(reason: string, oldReferenceId: number | null, maps: { sessions: Map<number, number>; records: Map<number, number> }) {
  if (oldReferenceId === null) return null;
  if (reason.startsWith("Sessão de treino")) return maps.sessions.get(oldReferenceId) ?? null;
  if (reason.startsWith("Resgate:")) return maps.records.get(oldReferenceId) ?? null;
  return null;
}

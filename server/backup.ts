import { z } from "zod";

const backupDate = z.union([z.string().min(1), z.date()]).nullable().optional();
const backupRow = z.record(z.string(), z.unknown());

export const backupPayloadSchema = z.object({
  version: z.number().int().min(1).max(2),
  exportedAt: z.string().optional(),
  records: z.array(backupRow).max(5000).default([]),
  habits: z.array(backupRow).max(1000).default([]),
  habitCompletions: z.array(backupRow).max(10000).default([]),
  tasks: z.array(backupRow).max(5000).default([]),
  goals: z.array(backupRow).max(1000).default([]),
  focusSessions: z.array(backupRow).max(5000).default([]),
  pointTransactions: z.array(backupRow).max(10000).default([]),
  auditLogs: z.array(backupRow).max(20000).default([]),
  settings: backupRow.nullable().default(null),
  exerciseLibrary: z.array(backupRow).max(5000).default([]),
  trainingPlans: z.array(backupRow).max(1000).default([]),
  trainingExercises: z.array(backupRow).max(10000).default([]),
  trainingSessions: z.array(backupRow).max(5000).default([]),
  trainingSets: z.array(backupRow).max(50000).default([]),
}).passthrough();

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
  const libraryIds = new Set(payload.exerciseLibrary.map(row => rowId(row, "Exercício da biblioteca")));
  const planIds = new Set(payload.trainingPlans.map(row => rowId(row, "Ficha")));
  const exerciseIds = new Set(payload.trainingExercises.map(row => rowId(row, "Exercício")));
  const sessionIds = new Set(payload.trainingSessions.map(row => rowId(row, "Sessão")));

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
  for (const row of payload.trainingExercises) {
    if (!planIds.has(requiredNumber(row, "planId", "Exercício"))) throw new Error("O backup contém um exercício ligado a uma ficha inexistente.");
    const libraryId = optionalNumber(row, "libraryId");
    if (libraryId !== null && !libraryIds.has(libraryId)) throw new Error("O backup contém um exercício ligado a uma biblioteca inexistente.");
  }
  for (const row of payload.trainingSessions) {
    if (!planIds.has(requiredNumber(row, "planId", "Sessão"))) throw new Error("O backup contém uma sessão ligada a uma ficha inexistente.");
  }
  for (const row of payload.trainingSets) {
    if (!sessionIds.has(requiredNumber(row, "sessionId", "Série")) || !exerciseIds.has(requiredNumber(row, "exerciseId", "Série"))) throw new Error("O backup contém uma série ligada a uma sessão ou exercício inexistente.");
  }
}

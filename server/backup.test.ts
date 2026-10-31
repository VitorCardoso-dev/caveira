import { describe, expect, it } from "vitest";
import { assertBackupRelationships, backupPayloadSchema, remapPointReference } from "./backup";

const row = (id: number, extra: Record<string, unknown> = {}) => ({ id, ...extra });

describe("backup completo", () => {
  it("aceita uma estrutura completa com relações de treino válidas", () => {
    const payload = backupPayloadSchema.parse({
      version: 2,
      records: [],
      habits: [row(1)],
      habitCompletions: [row(2, { habitId: 1 })],
      goals: [row(3, { automationType: "habit", automationRefId: 1 })],
      tasks: [row(4, { goalId: 3 })],
      pointActivities: [row(10, { sourceType: "habit", sourceId: 1, occurrenceDate: "2026-10-30", category: "Hábitos", basePoints: 6, status: "completed" })],
      pointTransactions: [row(11, { activityId: 10, points: 6, reason: "Hábito cumprido" })],
      exerciseLibrary: [row(5)],
      trainingPlans: [row(6)],
      trainingExercises: [row(7, { planId: 6, libraryId: 5 })],
      trainingSessions: [row(8, { planId: 6 })],
      trainingSets: [row(9, { sessionId: 8, exerciseId: 7 })],
    });
    expect(() => assertBackupRelationships(payload)).not.toThrow();
  });

  it("rejeita atividade pontuável ligada a uma origem inexistente", () => {
    const payload = backupPayloadSchema.parse({
      version: 2,
      records: [],
      pointActivities: [row(10, { sourceType: "task", sourceId: 99, occurrenceDate: "2026-10-30", category: "Trabalho", basePoints: 14, status: "missed" })],
    });
    expect(() => assertBackupRelationships(payload)).toThrow("tarefa inexistente");
  });

  it("rejeita referências órfãs antes de iniciar a restauração", () => {
    const payload = backupPayloadSchema.parse({
      version: 2,
      records: [],
      habits: [row(1)],
      habitCompletions: [row(2, { habitId: 99 })],
    });
    expect(() => assertBackupRelationships(payload)).toThrow("hábito inexistente");
  });

  it("rejeita séries ligadas a sessão ou exercício ausente", () => {
    const payload = backupPayloadSchema.parse({
      version: 2,
      records: [],
      trainingPlans: [row(1)],
      trainingExercises: [row(2, { planId: 1 })],
      trainingSessions: [row(3, { planId: 1 })],
      trainingSets: [row(4, { sessionId: 3, exerciseId: 999 })],
    });
    expect(() => assertBackupRelationships(payload)).toThrow("sessão ou exercício inexistente");
  });

  it("limita o tamanho de coleções para não aceitar backups abusivos", () => {
    const result = backupPayloadSchema.safeParse({ version: 2, records: Array.from({ length: 5001 }, (_, id) => row(id + 1)) });
    expect(result.success).toBe(false);
  });

  it("remapeia referências de pontos de treino e de resgate", () => {
    const maps = { sessions: new Map([[10, 110]]), records: new Map([[20, 220]]) };
    expect(remapPointReference("Sessão de treino concluída", 10, maps)).toBe(110);
    expect(remapPointReference("Resgate: cinema", 20, maps)).toBe(220);
    expect(remapPointReference("Ação desconhecida", 20, maps)).toBeNull();
  });
});

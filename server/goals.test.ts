import { describe, expect, it } from "vitest";
import { calculateGoalProgress } from "./routers";

const date = (value: string) => new Date(`${value}T12:00:00.000Z`);
const empty = { habitCompletions: [], tasks: [], focus: [], trainingDates: [], nutritionDates: [] };

describe("metas automáticas", () => {
  it("conta somente conclusões do hábito vinculado dentro do período", () => {
    const progress = calculateGoalProgress({ automationType: "habit", automationRefId: 4, progress: 0, target: 30, automationStartDate: date("2026-10-01"), createdAt: date("2026-10-01") }, { ...empty, habitCompletions: [
      { habitId: 4, day: date("2026-10-02"), status: "completed" },
      { habitId: 4, day: date("2026-10-03"), status: "completed" },
      { habitId: 9, day: date("2026-10-04"), status: "completed" },
      { habitId: 4, day: date("2026-09-30"), status: "completed" },
    ] }, "2026-10-10");
    expect(progress).toBe(2);
  });

  it("usa tarefas, foco, treino e alimentação reais e nunca ultrapassa o alvo", () => {
    expect(calculateGoalProgress({ automationType: "tasks", automationRefId: null, progress: 0, target: 2, automationStartDate: date("2026-10-01"), createdAt: date("2026-10-01") }, { ...empty, tasks: [
      { status: "completed", updatedAt: date("2026-10-02") },
      { status: "completed", updatedAt: date("2026-10-03") },
      { status: "completed", updatedAt: date("2026-10-04") },
    ] }, "2026-10-10")).toBe(2);
    expect(calculateGoalProgress({ automationType: "focus", automationRefId: null, progress: 0, target: 60, automationStartDate: date("2026-10-01"), createdAt: date("2026-10-01") }, { ...empty, focus: [{ durationMinutes: 25, createdAt: date("2026-10-02") }, { durationMinutes: 40, createdAt: date("2026-10-03") }] }, "2026-10-10")).toBe(60);
    expect(calculateGoalProgress({ automationType: "training", automationRefId: null, progress: 0, target: 10, automationStartDate: date("2026-10-01"), createdAt: date("2026-10-01") }, { ...empty, trainingDates: [date("2026-10-02"), date("2026-10-11")] }, "2026-10-10")).toBe(1);
    expect(calculateGoalProgress({ automationType: "tasks", automationRefId: 7, progress: 0, target: 10, automationStartDate: date("2026-10-01"), createdAt: date("2026-10-01") }, { ...empty, tasks: [{ status: "completed", updatedAt: date("2026-10-02"), goalId: 7 }, { status: "completed", updatedAt: date("2026-10-03"), goalId: 8 }] }, "2026-10-10")).toBe(1);
  });

  it("mantém metas manuais sob controle do usuário", () => {
    expect(calculateGoalProgress({ automationType: "manual", automationRefId: null, progress: 7, target: 10, automationStartDate: null, createdAt: date("2026-10-01") }, empty, "2026-10-10")).toBe(7);
  });
});

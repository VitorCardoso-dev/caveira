import { describe, expect, it } from "vitest";
import { calculateGoalProgress, calculateWeightedGoalProgress } from "./routers";

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
      { status: "completed", completedAt: date("2026-10-02") },
      { status: "completed", completedAt: date("2026-10-03") },
      { status: "completed", completedAt: date("2026-10-04") },
    ] }, "2026-10-10")).toBe(2);
    expect(calculateGoalProgress({ automationType: "focus", automationRefId: null, progress: 0, target: 60, automationStartDate: date("2026-10-01"), createdAt: date("2026-10-01") }, { ...empty, focus: [{ durationMinutes: 25, createdAt: date("2026-10-02") }, { durationMinutes: 40, createdAt: date("2026-10-03") }] }, "2026-10-10")).toBe(60);
    expect(calculateGoalProgress({ automationType: "training", automationRefId: null, progress: 0, target: 10, automationStartDate: date("2026-10-01"), createdAt: date("2026-10-01") }, { ...empty, trainingDates: [date("2026-10-02"), date("2026-10-11")] }, "2026-10-10")).toBe(1);
    expect(calculateGoalProgress({ automationType: "tasks", automationRefId: 7, progress: 0, target: 10, automationStartDate: date("2026-10-01"), createdAt: date("2026-10-01") }, { ...empty, tasks: [{ status: "completed", completedAt: date("2026-10-02"), goalId: 7 }, { status: "completed", completedAt: date("2026-10-03"), goalId: 8 }] }, "2026-10-10")).toBe(1);
  });

  it("mantém metas manuais sob controle do usuário", () => {
    expect(calculateGoalProgress({ automationType: "manual", automationRefId: null, progress: 7, target: 10, automationStartDate: null, createdAt: date("2026-10-01") }, empty, "2026-10-10")).toBe(7);
  });

  it("calcula fonte única e múltiplas fontes sem duplicar contribuições", () => {
    const goal = { automationType: "tasks", automationRefId: null, progress: 40, target: 100, automationStartDate: date("2026-10-01"), createdAt: date("2026-10-01") };
    const source = { ...empty, tasks: [{ status: "completed", completedAt: date("2026-10-02") }], focus: [{ durationMinutes: 60, createdAt: date("2026-10-03") }] };
    expect(calculateWeightedGoalProgress(goal, source, [{ sourceType: "tasks", sourceId: null, weightPercent: 100 }], "2026-10-10")).toBe(1);
    expect(calculateWeightedGoalProgress(goal, source, [{ sourceType: "tasks", sourceId: null, weightPercent: 50 }, { sourceType: "focus", sourceId: null, weightPercent: 50 }], "2026-10-10")).toBe(31);
    expect(calculateWeightedGoalProgress({ ...goal, automationType: "manual" }, empty, [{ sourceType: "manual", sourceId: null, weightPercent: 100 }], "2026-10-10")).toBe(40);
  });
  it("conta apenas tarefas explicitamente vinculadas à meta na fonte ponderada", () => {
    const goal = {
      goalId: 42,
      automationType: "focus",
      automationRefId: null,
      progress: 0,
      target: 10,
      automationStartDate: date("2026-10-01"),
      createdAt: date("2026-10-01"),
    };
    const source = {
      ...empty,
      tasks: [
        { status: "completed", completedAt: date("2026-10-02"), goalId: 42 },
        { status: "completed", completedAt: date("2026-10-03"), goalId: 99 },
        { status: "completed", completedAt: date("2026-10-04"), goalId: null },
      ],
    };

    expect(
      calculateWeightedGoalProgress(
        goal,
        source,
        [{ sourceType: "tasks", sourceId: null, weightPercent: 100 }],
        "2026-10-10",
      ),
    ).toBe(1);
  });

});

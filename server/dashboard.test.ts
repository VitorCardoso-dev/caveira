import { describe, expect, it } from "vitest";
import { calculateDailyScore } from "./routers";

describe("placar diário", () => {
  it("considera somente hábitos diários e tarefas do dia", () => {
    expect(
      calculateDailyScore(
        3,
        2,
        [{ status: "completed" }, { status: "todo" }],
      ),
    ).toBe(60);
  });

  it("não usa tarefas concluídas em outros dias para inflar o placar de hoje", () => {
    expect(calculateDailyScore(2, 1, [{ status: "todo" }, { status: "todo" }])).toBe(25);
  });

  it("retorna zero quando não existem obrigações hoje", () => {
    expect(calculateDailyScore(0, 0, [])).toBe(0);
  });

  it("limita o resultado ao intervalo de zero a cem", () => {
    expect(calculateDailyScore(1, 10, [])).toBe(100);
    expect(calculateDailyScore(1, -1, [{ status: "todo" }])).toBe(0);
  });
});

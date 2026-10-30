import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");

function procedureBlock(name: string) {
  const start = source.indexOf(`${name}: protectedProcedure`);
  expect(start).toBeGreaterThanOrEqual(0);
  return source.slice(start, source.indexOf("\n    }),", start) + 8);
}

describe("contrato de isolamento por usuário", () => {
  it("mantém operações sensíveis atrás de protectedProcedure", () => {
    for (const name of ["create", "update", "delete", "toggleComplete", "toggleToday", "saveSet", "finishSession"]) {
      expect(source).toContain(`${name}: protectedProcedure`);
    }
  });

  it("mantém filtros de propriedade para entidades principais", () => {
    for (const fragment of [
      "eq(habits.userId, ctx.user.id)",
      "eq(tasks.userId, ctx.user.id)",
      "eq(goals.userId, ctx.user.id)",
      "eq(trainingPlans.userId, ctx.user.id)",
      "eq(trainingSessions.userId, ctx.user.id)",
      "eq(trainingSets.userId, ctx.user.id)",
    ]) expect(source).toContain(fragment);
  });

  it("valida o pertencimento do exercício à sessão antes de salvar uma série", () => {
    const start = source.indexOf("saveSet: protectedProcedure");
    const end = source.indexOf("finishSession: protectedProcedure", start);
    const block = source.slice(start, end);
    expect(block).toContain("O exercício não pertence à ficha desta sessão.");
    expect(block).toContain("eq(trainingSessions.id, input.sessionId)");
    expect(block).toContain("eq(trainingExercises.userId, ctx.user.id)");
  });
});

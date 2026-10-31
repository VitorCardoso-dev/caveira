import { describe, expect, it } from "vitest";
import { missedPoints, pointsForCategory } from "./routers";

describe("pontuação por categoria", () => {
  it("aplica a distribuição aprovada sem apagar categorias existentes", () => {
    expect(pointsForCategory("Outros")).toBe(4);
    expect(pointsForCategory("Mente")).toBe(6);
    expect(pointsForCategory("Hábitos")).toBe(6);
    expect(pointsForCategory("Físico")).toBe(8);
    expect(pointsForCategory("Estudos")).toBe(10);
    expect(pointsForCategory("Alimentação")).toBe(12);
    expect(pointsForCategory("Trabalho")).toBe(14);
    expect(pointsForCategory("Financeiro")).toBe(14);
    expect(pointsForCategory("categoria legada desconhecida")).toBe(4);
  });

  it("calcula falha normal pela metade e corrosiva pelo dobro", () => {
    expect(missedPoints(10, false)).toBe(-5);
    expect(missedPoints(10, true)).toBe(-20);
    expect(missedPoints(14, false)).toBe(-7);
  });
});

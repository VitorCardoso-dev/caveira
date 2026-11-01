import { describe, expect, it } from "vitest";
import { calculateActivityTransition, calculateWalletBalance, calculateWeeklyCompletionRate, summarizeLedgerPeriod } from "./points-ledger";

describe("carteira e extrato de pontos", () => {
  it("reconstrói o saldo com créditos, débitos assinados e resgates legados", () => {
    expect(calculateWalletBalance([
      { movementType: "earned", points: 20 },
      { movementType: "missed", points: -4 },
      { movementType: "redemption", points: -30 },
      { movementType: "legacy", points: 8 },
    ])).toBe(-22);
  });

  it("separa o resumo semanal do saldo total da carteira", () => {
    const rows = [
      { movementType: "earned", points: 15, occurrenceDate: "2026-11-01" },
      { movementType: "redemption", points: -10, occurrenceDate: "2026-11-01" },
      { movementType: "earned", points: 40, occurrenceDate: "2026-10-20" },
      { movementType: "legacy", points: 5, occurrenceDate: "2026-11-01" },
      { movementType: "legacy", points: 12, occurrenceDate: "2026-10-10" },
    ];
    expect(summarizeLedgerPeriod(rows, "2026-10-26", "2026-11-01")).toEqual({ earned: 15, lost: 0, spent: 15, net: 0 });
    expect(calculateWalletBalance(rows)).toBe(28);
  });

  it("não mistura movimentos sem data no resumo do período, mas os mantém no saldo", () => {
    const rows = [{ movementType: "legacy", points: 7, occurrenceDate: null }];
    expect(summarizeLedgerPeriod(rows, "2026-10-26", "2026-11-01").spent).toBe(0);
    expect(calculateWalletBalance(rows)).toBe(-7);
  });

  it("reconcilia mudanças de estado uma vez e calcula apenas a diferença", () => {
    expect(calculateActivityTransition(null, 0, "completed", 8)).toBe(8);
    expect(calculateActivityTransition("completed", 8, "completed", 8)).toBeNull();
    expect(calculateActivityTransition("missed", -4, "completed", 8)).toBe(12);
    expect(calculateActivityTransition("completed", 8, "missed", -4)).toBe(-12);
  });

  it("calcula cumprimento com as obrigações que realmente pertencem à semana", () => {
    const result = calculateWeeklyCompletionRate(
      "2026-10-26",
      "2026-11-01",
      [
        { id: 1, createdAt: "2026-10-29" },
        { id: 2, createdAt: "2026-11-02" },
      ],
      [
        { habitId: 1, day: "2026-10-29", status: "completed" },
        { habitId: 1, day: "2026-10-30", status: "missed" },
        { habitId: 2, day: "2026-10-30", status: "completed" },
      ],
      [
        { id: 10, dueDate: "2026-10-30", updatedAt: "2026-10-30", status: "completed" },
        { id: 11, dueDate: "2026-10-31", updatedAt: "2026-10-31", status: "todo" },
        { id: 12, dueDate: null, updatedAt: "2026-10-20", status: "completed" },
      ],
    );
    expect(result).toEqual({ rate: 33, obligations: 6, completed: 2 });
  });
});

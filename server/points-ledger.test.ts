import { describe, expect, it } from "vitest";
import { calculateWalletBalance, summarizeLedgerPeriod } from "./points-ledger";

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
    expect(summarizeLedgerPeriod(rows, "2026-10-26", "2026-11-01")).toEqual({ earned: 15, lost: 10, spent: 5, net: 0 });
    expect(calculateWalletBalance(rows)).toBe(28);
  });

  it("não mistura movimentos sem data no resumo do período, mas os mantém no saldo", () => {
    const rows = [{ movementType: "legacy", points: 7, occurrenceDate: null }];
    expect(summarizeLedgerPeriod(rows, "2026-10-26", "2026-11-01").spent).toBe(0);
    expect(calculateWalletBalance(rows)).toBe(-7);
  });
});

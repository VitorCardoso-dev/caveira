import { describe, expect, it } from "vitest";
import { rewardCostPoints } from "./rewards";

describe("custo de recompensas", () => {
  it("aceita somente custos positivos em pontos inteiros", () => {
    expect(rewardCostPoints({ pointsRequired: 50 })).toBe(50);
    expect(rewardCostPoints({ pointsRequired: 1 })).toBe(1);
  });

  it("rejeita custos ausentes, não numéricos, fracionários ou não positivos", () => {
    expect(rewardCostPoints({})).toBeNull();
    expect(rewardCostPoints({ pointsRequired: "50" })).toBeNull();
    expect(rewardCostPoints({ pointsRequired: 1.5 })).toBeNull();
    expect(rewardCostPoints({ pointsRequired: 0 })).toBeNull();
    expect(rewardCostPoints({ pointsRequired: -10 })).toBeNull();
    expect(rewardCostPoints(null)).toBeNull();
  });
});

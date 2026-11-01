export function rewardCostPoints(details: unknown): number | null {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const value = (details as Record<string, unknown>).pointsRequired;
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

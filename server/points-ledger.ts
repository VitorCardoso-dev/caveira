export type PointLedgerMovement = {
  points: number;
  movementType: string;
  occurrenceDate?: Date | string | null;
};

function dayKey(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

/**
 * Legacy rows represented redemptions as positive costs. New ledger rows are signed.
 * Preserve that historical convention while deriving the wallet from the full ledger.
 */
export function calculateWalletBalance(rows: PointLedgerMovement[]) {
  return rows.reduce((balance, row) => balance + (row.movementType === "legacy" ? -Math.abs(row.points) : row.points), 0);
}

export function summarizeLedgerPeriod(rows: PointLedgerMovement[], start: string, end: string) {
  const inPeriod = rows.filter(row => {
    const day = dayKey(row.occurrenceDate);
    return day !== null && day >= start && day <= end;
  });
  const earned = inPeriod.reduce((sum, row) => sum + (row.movementType === "legacy" || row.movementType === "redemption" ? 0 : Math.max(0, row.points)), 0);
  const lost = inPeriod.reduce((sum, row) => sum + (row.movementType === "legacy" || row.movementType === "redemption" ? 0 : Math.min(0, row.points)), 0);
  const spent = inPeriod.reduce((sum, row) => sum + (row.movementType === "legacy" || row.movementType === "redemption" ? Math.abs(row.points) : 0), 0);
  return { earned, lost: Math.abs(lost), spent, net: earned - Math.abs(lost) - spent };
}

export function calculateActivityTransition(
  currentStatus: "completed" | "missed" | null,
  currentPoints: number,
  nextStatus: "completed" | "missed",
  nextPoints: number,
) {
  if (currentStatus === nextStatus) return null;
  return nextPoints - currentPoints;
}

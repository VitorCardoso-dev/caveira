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

export function calculateWeeklyCompletionRate(
  start: string,
  end: string,
  dailyHabits: Array<{ id: number; createdAt: Date | string }>,
  completions: Array<{ habitId: number; day: Date | string; status: string }>,
  tasks: Array<{ id: number; dueDate: Date | string | null; updatedAt: Date | string; status: string }>,
) {
  const habitById = new Map(dailyHabits.map(habit => [habit.id, dayKey(habit.createdAt) ?? start]));
  let habitOpportunities = 0;
  for (const created of habitById.values()) {
    const firstDay = created > start ? created : start;
    if (firstDay > end) continue;
    for (let cursor = new Date(`${firstDay}T12:00:00.000Z`); cursor <= new Date(`${end}T12:00:00.000Z`); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      habitOpportunities += 1;
    }
  }
  const completedHabitDays = new Set(completions
    .filter(row => row.status === "completed" && habitById.has(row.habitId))
    .filter(row => {
      const day = dayKey(row.day);
      const created = habitById.get(row.habitId)!;
      return day !== null && day >= start && day <= end && day >= created;
    })
    .map(row => `${row.habitId}:${dayKey(row.day)}`));
  const weeklyTasks = tasks.filter(task => {
    const dueDay = dayKey(task.dueDate);
    const completedDay = task.status === "completed" ? dayKey(task.updatedAt) : null;
    return Boolean((dueDay && dueDay >= start && dueDay <= end) || (completedDay && completedDay >= start && completedDay <= end));
  });
  const completedTasks = weeklyTasks.filter(task => task.status === "completed").length;
  const obligations = habitOpportunities + weeklyTasks.length;
  const completed = completedHabitDays.size + completedTasks;
  return { rate: obligations ? Math.round((completed / obligations) * 100) : 0, obligations, completed };
}

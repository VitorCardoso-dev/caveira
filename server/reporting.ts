export function isWithinReportPeriod(value: Date | string | null | undefined, start: string, end: string) {
  if (!value) return false;
  const day = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  return day >= start && day <= end;
}

export function getReportWindows(today: string) {
  const date = new Date(`${today}T12:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== today) {
    throw new Error("Data de referência inválida.");
  }
  const month = today.slice(0, 7);
  const monthStart = `${month}-01`;
  const monthDays = Number(today.slice(8, 10));
  const dailyDays: string[] = [];
  for (let offset = 13; offset >= 0; offset -= 1) {
    const day = new Date(date);
    day.setUTCDate(day.getUTCDate() - offset);
    dailyDays.push(day.toISOString().slice(0, 10));
  }
  const monthToDateDays = Array.from({ length: monthDays }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
  return { today, month, monthStart, monthDays, dailyDays, monthToDateDays };
}

const DAY_MS = 86_400_000;

/** `2030-01-07` → `7 Jan` (the calendar day as written, no time zone arithmetic). */
export function shortDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  if (!y || !m || !d) return day;
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Every calendar day from `from` to `to` inclusive (`YYYY-MM-DD`), oldest first. */
export function eachDay(from: string, to: string): string[] {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return [];
  const days: string[] = [];
  for (let t = start; t <= end && days.length < 400; t += DAY_MS) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

/**
 * The server only reports days that had bookings. A trend needs every day, so the quiet days are filled in with zeros.
 */
export function fillDays<T extends { day: string }>(
  rows: readonly T[],
  from: string,
  to: string,
  empty: (day: string) => T,
): T[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  return eachDay(from, to).map((day) => byDay.get(day) ?? empty(day));
}

/**
 * Time-zone helpers built on `Intl` (no dependency). Instants are always UTC `Date`s; "local" means the drawer's IANA
 * time zone (README: timestamps are UTC, display and opening hours use the drawer's zone).
 */

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export function isValidTimeZone(timeZone: string): boolean {
  if (timeZone === 'UTC') return true;
  // Only real region names ("Asia/Kolkata"); not abbreviations or numeric offsets that Intl may also accept.
  if (!/^[A-Z][A-Za-z_]*(\/[A-Z][A-Za-z0-9_+-]*)+$/.test(timeZone)) return false;
  try {
    formatter(timeZone); // throws RangeError for a zone the runtime does not know
    return true;
  } catch {
    return false;
  }
}

export interface LocalParts {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM:SS
  weekday: number; // ISO: 1 = Monday … 7 = Sunday
}

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** The wall-clock reading of an instant in a zone. */
export function localParts(instant: Date, timeZone: string): LocalParts {
  const parts: Record<string, string> = {};
  for (const p of formatter(timeZone).formatToParts(instant)) parts[p.type] = p.value;
  return {
    date: `${parts['year']}-${parts['month']}-${parts['day']}`,
    time: `${parts['hour']}:${parts['minute']}:${parts['second']}`,
    weekday: WEEKDAYS[parts['weekday'] ?? ''] ?? 1,
  };
}

/** Offset of the zone from UTC at an instant, in minutes (positive east of Greenwich). */
function offsetMinutes(instant: Date, timeZone: string): number {
  const local = localParts(instant, timeZone);
  const asUtc = Date.parse(`${local.date}T${local.time}Z`);
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000);
}

/**
 * The UTC instant at which the wall clock in `timeZone` reads `date` + `time`. For a time that does not exist (spring
 * forward) the instant after the gap is returned; for an ambiguous time (fall back) the first occurrence.
 */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const naive = Date.parse(`${date}T${time.length === 5 ? `${time}:00` : time}Z`);
  let guess = naive - offsetMinutes(new Date(naive), timeZone) * 60_000;
  guess = naive - offsetMinutes(new Date(guess), timeZone) * 60_000; // re-evaluate across a DST boundary
  return new Date(guess);
}

/** ISO weekday (1 = Monday … 7 = Sunday) of a calendar date, independent of any zone. */
export function isoWeekday(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return day === 0 ? 7 : day;
}

export const isCalendarDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
};

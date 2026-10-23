const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export interface DayHours {
  weekday: number; // 1 = Monday … 7 = Sunday
  opensAt: string;
  closesAt: string;
}

const span = (from: number, to: number): string =>
  from === to ? DAYS[from - 1]! : `${DAYS[from - 1]}–${DAYS[to - 1]}`;

/**
 * Opening hours in the fewest words: days in a row with the same hours are one group ("Mon–Fri 09:00–21:00"), seven
 * identical days are "Every day …", and days with no hours are named as closed.
 */
export function summariseHours(hours: readonly DayHours[]): string {
  if (hours.length === 0) return 'No opening hours set';
  const byDay = new Map(hours.map((h) => [h.weekday, `${h.opensAt}–${h.closesAt}`]));
  const groups: Array<{ from: number; to: number; text: string }> = [];
  for (let day = 1; day <= 7; day += 1) {
    const text = byDay.get(day);
    if (text === undefined) continue;
    const last = groups[groups.length - 1];
    if (last && last.to === day - 1 && last.text === text) last.to = day;
    else groups.push({ from: day, to: day, text });
  }
  if (groups.length === 1 && groups[0]!.from === 1 && groups[0]!.to === 7) {
    return `Every day ${groups[0]!.text}`;
  }
  const open = groups.map((g) => `${span(g.from, g.to)} ${g.text}`).join(' · ');
  const closed: string[] = [];
  for (let day = 1; day <= 7; day += 1) if (!byDay.has(day)) closed.push(DAYS[day - 1]!);
  return closed.length > 0 ? `${open} · closed ${closed.join(', ')}` : open;
}

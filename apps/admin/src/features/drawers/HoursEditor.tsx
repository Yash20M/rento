import type { Hours } from '@/api/types';
import { Checkbox } from '@/components/ui/controls';
import { Input } from '@/components/ui/input';

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export interface HoursRow {
  open: boolean;
  opensAt: string;
  closesAt: string;
}
/** Seven rows, Monday first. */
export type HoursRows = HoursRow[];

export const DEFAULT_HOURS: HoursRows = DAYS.map(() => ({
  open: true,
  opensAt: '09:00',
  closesAt: '21:00',
}));

export const hoursToRows = (hours: readonly Hours[]): HoursRows =>
  DAYS.map((_, index) => {
    const found = hours.find((h) => h.weekday === index + 1);
    return found
      ? { open: true, opensAt: found.opensAt.slice(0, 5), closesAt: found.closesAt.slice(0, 5) }
      : { open: false, opensAt: '09:00', closesAt: '21:00' };
  });

export const hoursFromRows = (rows: HoursRows): Hours[] =>
  rows.flatMap((row, index) =>
    row.open ? [{ weekday: index + 1, opensAt: row.opensAt, closesAt: row.closesAt }] : [],
  );

/** One line per weekday: open or closed, and when. Server messages are matched by `hours.<n>.<field>`. */
export function HoursEditor({
  rows,
  onChange,
  errors = {},
}: {
  rows: HoursRows;
  onChange: (rows: HoursRows) => void;
  errors?: Readonly<Record<string, string>>;
}) {
  const set = (index: number, patch: Partial<HoursRow>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  // The server numbers rows among the OPEN days only; map its index back to the weekday row.
  const openIndex = rows.flatMap((row, i) => (row.open ? [i] : []));
  const messageFor = (rowIndex: number): string | undefined => {
    const position = openIndex.indexOf(rowIndex);
    if (position < 0) return undefined;
    return (
      errors[`hours.${position}.closesAt`] ??
      errors[`hours.${position}.opensAt`] ??
      errors[`hours.${position}.weekday`]
    );
  };

  return (
    <ul className="grid gap-2" aria-label="Opening hours">
      {rows.map((row, index) => {
        const message = messageFor(index);
        return (
          <li key={DAYS[index]} className="grid grid-cols-[8rem_1fr] items-center gap-3">
            <Checkbox
              label={DAYS[index] ?? ''}
              checked={row.open}
              onChange={(e) => set(index, { open: e.target.checked })}
            />
            {row.open ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Input
                  type="time"
                  aria-label={`${DAYS[index]} opens`}
                  className="w-32"
                  value={row.opensAt}
                  onChange={(e) => set(index, { opensAt: e.target.value })}
                />
                <span>to</span>
                <Input
                  type="time"
                  aria-label={`${DAYS[index]} closes`}
                  className="w-32"
                  value={row.closesAt}
                  onChange={(e) => set(index, { closesAt: e.target.value })}
                />
                {message && (
                  <span role="alert" className="text-xs text-destructive">
                    {message}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Closed</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

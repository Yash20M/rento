const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
});

/** Integer paise → `₹1,234.50`. Money is never a float inside the app; this is display only. */
export const formatPaise = (paise: number): string => rupees.format(paise / 100);

/** What a person types in a rupee field → integer paise, or `undefined` when it is not a valid amount. */
export function rupeesToPaise(input: string): number | undefined {
  const text = input.trim().replace(/^₹\s*/, '').replace(/,/g, '');
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(text)) return undefined;
  const [whole = '0', fraction = ''] = text.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

/** Integer paise → the text shown in a rupee field (`1234.5` → `1234.50`; whole rupees without decimals). */
export const paiseToRupees = (paise: number): string =>
  paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);

/** An instant shown in a given IANA time zone (the drawer's own, or the browser's when omitted). */
export function formatDateTime(iso: string, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...(timeZone && { timeZone }),
  }).format(date);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** `no_show` → `No show`. */
export const humanize = (value: string): string => {
  const text = value.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * A wall-clock time in a given IANA time zone (`2030-01-07T09:00`, as a `datetime-local` field gives it) → the UTC
 * instant. Used for drawer closures, which people think of in the drawer's own time. `undefined` when malformed.
 */
export function zonedLocalToIso(local: string, timeZone: string): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match) return undefined;
  const [year, month, day, hour, minute] = [1, 2, 3, 4, 5].map((i) => Number(match[i]));
  const wall = Date.UTC(
    year as number,
    (month as number) - 1,
    day as number,
    hour as number,
    minute as number,
  );

  // How far ahead of UTC the zone is at instant `t`, in milliseconds.
  const offsetAt = (t: number): number => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(new Date(t));
    const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    return (
      Date.UTC(
        part('year'),
        part('month') - 1,
        part('day'),
        part('hour'),
        part('minute'),
        part('second'),
      ) - t
    );
  };

  let instant = wall - offsetAt(wall);
  instant = wall - offsetAt(instant); // a second pass settles times next to a daylight-saving change
  return Number.isNaN(instant) ? undefined : new Date(instant).toISOString();
}

/** The price after an offer: the discount is whole paise, rounded DOWN (the same rule the server applies). */
export const offerPricePaise = (pricePaise: number, percent: number): number =>
  pricePaise - Math.floor((pricePaise * percent) / 100);

const pad = (n: number): string => String(n).padStart(2, '0');

/** An instant → the value of an `<input type="datetime-local">`, in the viewer's own time zone. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * What a `datetime-local` field holds (the viewer's local time) → an ISO instant in UTC. `null` for an empty field,
 * `undefined` when the text is not a real date and time.
 */
export function fromLocalInput(text: string): string | null | undefined {
  const value = text.trim();
  if (value === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** A short date and time in the viewer's time zone, e.g. `7 Jan, 10:30 am`. */
export function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

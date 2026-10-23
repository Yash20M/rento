/** A "nice" upper bound for a chart axis: 1, 2, 2.5, 5 or 10 times a power of ten, never below the data. */
export function niceMax(max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 1;
  const exponent = Math.floor(Math.log10(max));
  const base = 10 ** exponent;
  const fraction = max / base;
  const step = [1, 2, 2.5, 5, 10].find((s) => fraction <= s) ?? 10;
  return step * base;
}

/** Evenly spaced axis values from 0 to `max` (inclusive), `count` intervals. */
export function ticks(max: number, count = 4): number[] {
  return Array.from({ length: count + 1 }, (_, i) => (max / count) * i);
}

/** Maps a value in [0, max] onto [bottom, top] pixel rows (bottom > top, as in SVG). */
export const yFor = (value: number, max: number, top: number, bottom: number): number =>
  bottom - (max === 0 ? 0 : Math.min(1, Math.max(0, value / max))) * (bottom - top);

/**
 * A smooth line through the points that never overshoots between them (monotone cubic, as in d3's curveMonotoneX), so a
 * dip to zero does not draw below the axis.
 */
export function smoothPath(points: ReadonlyArray<readonly [number, number]>): string {
  const n = points.length;
  if (n === 0) return '';
  const first = points[0]!;
  if (n === 1) return `M${first[0]},${first[1]}`;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const [x0, y0] = points[i]!;
    const [x1, y1] = points[i + 1]!;
    dx.push(x1 - x0);
    slope.push(x1 === x0 ? 0 : (y1 - y0) / (x1 - x0));
  }
  const tangent: number[] = [slope[0]!];
  for (let i = 1; i < n - 1; i += 1) {
    const a = slope[i - 1]!;
    const b = slope[i]!;
    tangent.push(a * b <= 0 ? 0 : (2 * a * b) / (a + b));
  }
  tangent.push(slope[n - 2]!);
  let d = `M${first[0]},${first[1]}`;
  for (let i = 0; i < n - 1; i += 1) {
    const [x0, y0] = points[i]!;
    const [x1, y1] = points[i + 1]!;
    const h = dx[i]! / 3;
    d += `C${x0 + h},${y0 + tangent[i]! * h} ${x1 - h},${y1 - tangent[i + 1]! * h} ${x1},${y1}`;
  }
  return d;
}

/** Share of a total as a whole percentage, "0%" for an empty total. */
export const percent = (value: number, total: number): string =>
  total <= 0 ? '0%' : `${Math.round((value / total) * 100)}%`;

/** A short axis label for rupee amounts held in paise: ₹0, ₹850, ₹1.2k, ₹3.4L, ₹1.1Cr. */
export function compactRupees(paise: number): string {
  const rupees = Math.round(paise / 100);
  const fmt = (n: number, unit: string) => `₹${(Math.round(n * 10) / 10).toString()}${unit}`;
  if (rupees >= 10_000_000) return fmt(rupees / 10_000_000, 'Cr');
  if (rupees >= 100_000) return fmt(rupees / 100_000, 'L');
  if (rupees >= 1_000) return fmt(rupees / 1_000, 'k');
  return `₹${rupees}`;
}

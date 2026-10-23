import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { niceMax, percent, smoothPath, ticks, yFor } from './scale';

export interface Point {
  /** The text under the point (a day, a name). */
  label: string;
  value: number;
}

const DEFAULT_W = 640;

/** The width the chart really has, so text stays the same size on every screen (falls back to a fixed width). */
function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(DEFAULT_W);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const w = Math.round(entry?.contentRect.width ?? 0);
      if (w > 0) setWidth(Math.max(280, w));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}
const PAD = { top: 14, right: 14, bottom: 28, left: 52 };

const Hidden = ({ children }: { children: React.ReactNode }) => (
  <div className="sr-only">{children}</div>
);

/** Every chart also exists as a table for people who cannot see it (and for tests). */
function DataTable({
  caption,
  data,
  format,
}: {
  caption: string;
  data: Point[];
  format: (v: number) => string;
}) {
  return (
    <Hidden>
      <table>
        <caption>{caption}</caption>
        <tbody>
          {data.map((p) => (
            <tr key={p.label}>
              <th scope="row">{p.label}</th>
              <td>{format(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Hidden>
  );
}

function Frame({
  width: W,
  height,
  max,
  yFormat,
  children,
  title,
}: {
  width: number;
  height: number;
  max: number;
  yFormat: (v: number) => string;
  children: React.ReactNode;
  title: string;
}) {
  const bottom = height - PAD.bottom;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full" role="img" aria-label={title}>
      {ticks(max).map((t) => {
        const y = yFor(t, max, PAD.top, bottom);
        return (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeDasharray={t === 0 ? undefined : '3 4'}
            />
            <text
              x={PAD.left - 8}
              y={y + 4}
              textAnchor="end"
              fontSize="11"
              fill="var(--muted-foreground)"
            >
              {yFormat(t)}
            </text>
          </g>
        );
      })}
      {children}
    </svg>
  );
}

/** Which x labels to print so they never crowd each other (about seven are shown). */
const labelEvery = (n: number): number => Math.max(1, Math.ceil(n / 7));

function Tooltip({
  x,
  y,
  lines,
  chartWidth: W,
}: {
  x: number;
  y: number;
  lines: string[];
  chartWidth: number;
}) {
  const width = Math.max(...lines.map((l) => l.length)) * 6.4 + 18;
  const height = lines.length * 16 + 12;
  const left = Math.min(Math.max(x - width / 2, PAD.left), W - PAD.right - width);
  const top = Math.max(y - height - 12, 2);
  return (
    <g pointerEvents="none">
      <rect
        x={left}
        y={top}
        width={width}
        height={height}
        rx="8"
        fill="var(--foreground)"
        opacity="0.92"
      />
      {lines.map((line, i) => (
        <text
          key={line}
          x={left + 9}
          y={top + 18 + i * 16}
          fontSize="11.5"
          fontWeight={i === 0 ? 600 : 400}
          fill="var(--background)"
        >
          {line}
        </text>
      ))}
    </g>
  );
}

/** A smooth filled trend line (revenue or bookings over days). */
export function AreaChart({
  data,
  title,
  format = (v) => String(v),
  axisFormat = format,
  color = 'var(--chart-1)',
  height = 230,
  className,
}: {
  data: Point[];
  title: string;
  format?: (value: number) => string;
  axisFormat?: (value: number) => string;
  color?: string;
  height?: number;
  className?: string;
}) {
  const gradient = useId();
  const [boxRef, W] = useWidth();
  const [active, setActive] = useState<number | undefined>(undefined);
  const max = niceMax(Math.max(0, ...data.map((p) => p.value)));
  const bottom = height - PAD.bottom;
  const step = data.length > 1 ? (W - PAD.left - PAD.right) / (data.length - 1) : 0;
  const xs = data.map((_, i) =>
    data.length > 1 ? PAD.left + i * step : (PAD.left + W - PAD.right) / 2,
  );
  const points = data.map((p, i) => [xs[i]!, yFor(p.value, max, PAD.top, bottom)] as const);
  const line = smoothPath(points);
  const area =
    points.length > 1 ? `${line}L${xs[xs.length - 1]},${bottom}L${xs[0]},${bottom}Z` : '';
  const every = labelEvery(data.length);
  const hit = data.length > 1 ? step : W - PAD.left - PAD.right;

  return (
    <div ref={boxRef} className={cn('w-full', className)}>
      <Frame width={W} height={height} max={max} yFormat={axisFormat} title={title}>
        <defs>
          <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.38" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {area && <path d={area} fill={`url(#${gradient})`} />}
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {data.map((p, i) => (
          <text
            key={p.label}
            x={xs[i]}
            y={height - 8}
            textAnchor="middle"
            fontSize="11"
            fill="var(--muted-foreground)"
            opacity={i % every === 0 ? 1 : 0}
          >
            {p.label}
          </text>
        ))}
        {active !== undefined && (
          <>
            <line
              x1={xs[active]}
              x2={xs[active]}
              y1={PAD.top}
              y2={bottom}
              stroke={color}
              strokeOpacity="0.35"
            />
            <circle
              cx={points[active]![0]}
              cy={points[active]![1]}
              r="5"
              fill="var(--background)"
              stroke={color}
              strokeWidth="2.5"
            />
            <Tooltip
              chartWidth={W}
              x={xs[active]!}
              y={points[active]![1]}
              lines={[data[active]!.label, format(data[active]!.value)]}
            />
          </>
        )}
        {data.map((p, i) => (
          <rect
            key={p.label}
            x={xs[i]! - hit / 2}
            y={PAD.top}
            width={hit}
            height={bottom - PAD.top}
            fill="transparent"
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(undefined)}
          />
        ))}
      </Frame>
      <DataTable caption={title} data={data} format={format} />
    </div>
  );
}

/** Rounded vertical bars (bookings per day, collected money per day). */
export function BarChart({
  data,
  title,
  format = (v) => String(v),
  axisFormat = format,
  color = 'var(--chart-1)',
  height = 230,
  className,
}: {
  data: Point[];
  title: string;
  format?: (value: number) => string;
  axisFormat?: (value: number) => string;
  color?: string;
  height?: number;
  className?: string;
}) {
  const [boxRef, W] = useWidth();
  const [active, setActive] = useState<number | undefined>(undefined);
  const max = niceMax(Math.max(0, ...data.map((p) => p.value)));
  const bottom = height - PAD.bottom;
  const slot = (W - PAD.left - PAD.right) / Math.max(1, data.length);
  const barWidth = Math.min(46, slot * 0.62);
  const every = labelEvery(data.length);

  return (
    <div ref={boxRef} className={cn('w-full', className)}>
      <Frame width={W} height={height} max={max} yFormat={axisFormat} title={title}>
        {data.map((p, i) => {
          const x = PAD.left + slot * i + (slot - barWidth) / 2;
          const y = yFor(p.value, max, PAD.top, bottom);
          const h = Math.max(p.value > 0 ? 3 : 0, bottom - y);
          return (
            <g key={p.label}>
              <rect
                x={PAD.left + slot * i}
                y={PAD.top}
                width={slot}
                height={bottom - PAD.top}
                fill={active === i ? 'var(--muted)' : 'transparent'}
                opacity="0.6"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(undefined)}
              />
              <rect
                x={x}
                y={bottom - h}
                width={barWidth}
                height={h}
                rx={Math.min(8, barWidth / 2)}
                fill={color}
                opacity={active === undefined || active === i ? 1 : 0.55}
              />
              <text
                x={PAD.left + slot * i + slot / 2}
                y={height - 8}
                textAnchor="middle"
                fontSize="11"
                fill="var(--muted-foreground)"
                opacity={i % every === 0 ? 1 : 0}
              >
                {p.label}
              </text>
            </g>
          );
        })}
        {active !== undefined && (
          <Tooltip
            chartWidth={W}
            x={PAD.left + slot * active + slot / 2}
            y={yFor(data[active]!.value, max, PAD.top, bottom)}
            lines={[data[active]!.label, format(data[active]!.value)]}
          />
        )}
      </Frame>
      <DataTable caption={title} data={data} format={format} />
    </div>
  );
}

export interface Slice {
  label: string;
  value: number;
  color: string;
}

/** A ring split into parts with the total in the middle and a legend (what share is what). */
export function Donut({
  slices,
  title,
  centerLabel,
  size = 160,
}: {
  slices: Slice[];
  title: string;
  centerLabel: string;
  size?: number;
}) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 140 140" width={size} height={size} role="img" aria-label={title}>
        <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--muted)" strokeWidth="16" />
        {total > 0 &&
          slices
            .filter((s) => s.value > 0)
            .map((s) => {
              const length = (s.value / total) * circumference;
              const gap = slices.filter((x) => x.value > 0).length > 1 ? 2 : 0;
              const dash = `${Math.max(0, length - gap)} ${circumference - Math.max(0, length - gap)}`;
              const el = (
                <circle
                  key={s.label}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="16"
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 70 70)"
                  strokeLinecap="butt"
                />
              );
              offset += length;
              return el;
            })}
        <text
          x="70"
          y="68"
          textAnchor="middle"
          fontSize="24"
          fontWeight="700"
          fill="var(--foreground)"
        >
          {total}
        </text>
        <text x="70" y="86" textAnchor="middle" fontSize="10.5" fill="var(--muted-foreground)">
          {centerLabel}
        </text>
      </svg>
      <ul className="grid gap-1.5 text-sm" aria-label={`${title} legend`}>
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-full"
              style={{ background: s.color }}
              aria-hidden="true"
            />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="ml-auto pl-4 font-medium tabular-nums">
              {s.value}{' '}
              <span className="text-xs font-normal text-muted-foreground">
                {percent(s.value, total)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A ranked list with proportional bars (drawers, products). */
export function BarList({
  rows,
  title,
  format,
  color = 'var(--chart-1)',
}: {
  rows: Array<{ label: string; value: number; hint?: string }>;
  title: string;
  format: (value: number) => string;
  color?: string;
}) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  return (
    <ul className="grid gap-3" aria-label={title}>
      {rows.map((r) => (
        <li key={r.label} className="grid gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium">{r.label}</span>
            <span className="tabular-nums">{format(r.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${r.value <= 0 || max === 0 ? 0 : Math.max(2, (r.value / max) * 100)}%`,
                background: color,
              }}
            />
          </div>
          {r.hint && <span className="text-xs text-muted-foreground">{r.hint}</span>}
        </li>
      ))}
    </ul>
  );
}

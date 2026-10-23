import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatTone = 'primary' | 'teal' | 'amber' | 'rose' | 'green';

const TONES: Record<StatTone, string> = {
  primary: 'bg-[var(--chart-1)]/12 text-[var(--chart-1)]',
  teal: 'bg-[var(--chart-2)]/15 text-[var(--chart-2)]',
  amber: 'bg-[var(--chart-3)]/18 text-[var(--chart-3)]',
  rose: 'bg-[var(--chart-4)]/14 text-[var(--chart-4)]',
  green: 'bg-[var(--chart-5)]/15 text-[var(--chart-5)]',
};

/** One headline number with a tinted icon, a label and an optional line of explanation. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'primary',
}: {
  label: string;
  value: string | number;
  hint?: string | undefined;
  icon?: LucideIcon;
  tone?: StatTone;
}) {
  // A description-list group holds the term and its value directly (screen readers read "Bookings, 12").
  return (
    <div className="relative rounded-2xl border bg-card p-4 shadow-card">
      <dt className="pr-12 text-sm text-muted-foreground">
        {label}
        {Icon && (
          <span
            aria-hidden="true"
            className={cn(
              'absolute right-4 top-4 grid size-10 place-items-center rounded-xl',
              TONES[tone],
            )}
          >
            <Icon className="size-5" />
          </span>
        )}
      </dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums sm:text-2xl">
        {value}
        {hint && (
          <span className="mt-1 block text-xs font-normal tracking-normal text-muted-foreground">
            {hint}
          </span>
        )}
      </dd>
    </div>
  );
}

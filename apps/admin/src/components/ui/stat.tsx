import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatTone = 'primary' | 'teal' | 'amber' | 'rose' | 'green';

const TONES: Record<StatTone, string> = {
  primary: 'bg-[var(--chart-1)]/15 text-[var(--brand-text)]',
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
    <div className="min-w-0 rounded-2xl border bg-card p-4 shadow-card">
      <dt className="flex items-start justify-between gap-2 text-sm text-muted-foreground">
        <span className="min-w-0">{label}</span>
        {Icon && (
          <span
            aria-hidden="true"
            className={cn('grid size-9 shrink-0 place-items-center rounded-xl', TONES[tone])}
          >
            <Icon className="size-[18px]" />
          </span>
        )}
      </dt>
      <dd className="mt-1 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
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

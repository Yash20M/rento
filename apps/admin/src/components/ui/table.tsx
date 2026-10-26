import * as React from 'react';
import { cn } from '@/lib/utils';

/** Plain, accessible table primitives (a scrollable wrapper keeps wide tables usable on small screens). */
export const Table = ({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) => (
  // A wide table scrolls sideways inside this wrapper, so the wrapper must be reachable and operable by keyboard.
  <div
    role="region"
    aria-label={props['aria-label'] ?? 'Table'}
    tabIndex={0}
    className="relative w-full min-w-0 max-w-full overflow-x-auto rounded-2xl border bg-card shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
  >
    <table className={cn('w-full min-w-[46rem] caption-bottom text-sm', className)} {...props} />
  </div>
);

export const THead = (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead
    className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"
    {...props}
  />
);

export const TBody = (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className="divide-y" {...props} />
);

export const Tr = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={cn('align-middle transition-colors hover:bg-muted/40', className)} {...props} />
);

export const Th = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th scope="col" className={cn('px-3 py-2 font-medium whitespace-nowrap', className)} {...props} />
);

export const Td = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn('px-3 py-2', className)} {...props} />
);

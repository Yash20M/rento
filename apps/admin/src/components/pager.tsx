import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PAGE_SIZES, type Paged } from '@/lib/use-paged';

/** Previous / next with the rows on screen and a rows-per-page choice. Shown under every table. */
export function Pager<T>({ pager, label = 'rows' }: { pager: Paged<T>; label?: string }) {
  if (pager.rows.length === 0 && !pager.hasPrevious) return null;
  const last = pager.firstRow + pager.rows.length - 1;
  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"
    >
      <p aria-live="polite">
        Showing{' '}
        <strong className="font-medium text-foreground tabular-nums">
          {pager.firstRow}–{last}
        </strong>{' '}
        {label} · page <span className="tabular-nums">{pager.page}</span>
      </p>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2">
          <span>Rows per page</span>
          <select
            aria-label="Rows per page"
            className="h-8 rounded-md border border-input bg-background px-2 text-foreground"
            value={pager.pageSize}
            onChange={(e) => pager.setPageSize(Number(e.target.value))}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={pager.previous}
            disabled={!pager.hasPrevious || pager.isFetching}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" aria-hidden="true" /> Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={pager.next}
            disabled={!pager.hasNext || pager.isFetching}
            aria-label="Next page"
          >
            Next <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </nav>
  );
}

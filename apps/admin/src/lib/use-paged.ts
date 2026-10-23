import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

export const PAGE_SIZES = [10, 25, 50] as const;
const DEFAULT_SIZE = 25;

export interface PageOf<T> {
  items: T[];
  nextCursor: string | null | undefined;
}

const storageKey = (name: string) => `rento.admin.pagesize.${name}`;

function savedSize(name: string): number {
  try {
    const value = Number(window.localStorage.getItem(storageKey(name)));
    return (PAGE_SIZES as readonly number[]).includes(value) ? value : DEFAULT_SIZE;
  } catch {
    return DEFAULT_SIZE;
  }
}

export interface Paged<T> {
  rows: T[];
  /** 1-based number of the page on screen. */
  page: number;
  pageSize: number;
  /** Index of the first row on screen, 1-based (for "Showing 26–50"). */
  firstRow: number;
  hasPrevious: boolean;
  hasNext: boolean;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  isSuccess: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
  next: () => void;
  previous: () => void;
  setPageSize: (size: number) => void;
}

/**
 * Page-by-page reading of a cursor-paged API list: "previous / next" with the cursors of the pages already visited kept
 * on a stack (so going back is exact and never skips or repeats a row). Changing the filters (`resetKey`) or the page
 * size returns to page 1. The chosen page size is remembered per table.
 */
export function usePaged<T>(options: {
  /** A short stable name of the table (storage key). */
  name: string;
  /** Everything that identifies the list besides the page: the filters. */
  filters: readonly unknown[];
  fetchPage: (cursor: string | undefined, limit: number) => Promise<PageOf<T>>;
}): Paged<T> {
  const { name, filters, fetchPage } = options;
  const [size, setSize] = useState(() => savedSize(name));
  // Cursors of the pages visited so far; index 0 is page 1 (no cursor).
  const [stack, setStack] = useState<Array<string | undefined>>([undefined]);
  const signature = useMemo(() => JSON.stringify(filters), [filters]);
  const [seen, setSeen] = useState(signature);
  if (seen !== signature) {
    // The filters changed: start again from the first page.
    setSeen(signature);
    setStack([undefined]);
  }

  const cursor = stack[stack.length - 1];
  const query = useQuery({
    queryKey: ['paged', name, signature, size, cursor ?? null],
    queryFn: () => fetchPage(cursor, size),
    placeholderData: keepPreviousData,
  });
  const nextCursor = query.data?.nextCursor ?? undefined;

  const next = useCallback(() => {
    if (nextCursor !== undefined) setStack((s) => [...s, nextCursor]);
  }, [nextCursor]);
  const previous = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  const setPageSize = useCallback(
    (value: number) => {
      try {
        window.localStorage.setItem(storageKey(name), String(value));
      } catch {
        // the choice then simply lasts until the page is closed
      }
      setSize(value);
      setStack([undefined]);
    },
    [name],
  );

  const page = stack.length;
  return {
    rows: query.data?.items ?? [],
    page,
    pageSize: size,
    firstRow: (page - 1) * size + 1,
    hasPrevious: page > 1,
    hasNext: nextCursor !== undefined,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    isSuccess: query.isSuccess,
    error: query.error,
    refetch: () => query.refetch(),
    next,
    previous,
    setPageSize,
  };
}

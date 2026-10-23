import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useApi } from '@/api/api-provider';
import { unwrap } from '@/api/errors';
import { useAuth } from '@/auth/auth-context';
import { Pager } from '@/components/pager';
import { EmptyState, ErrorNote, Loading, PageHeader } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Select, TextField } from '@/components/ui/controls';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { usePaged } from '@/lib/use-paged';
import { formatDateTime, formatDuration, formatPaise } from '@/lib/format';
import { BookingDetailModal } from './BookingDetailModal';
import { STATUS_OPTIONS, StatusBadge, statusLabel } from './status';

export function BookingsPage() {
  const api = useApi();
  const { can } = useAuth();
  const [status, setStatus] = useState('');
  const [drawerId, setDrawerId] = useState('');
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [openId, setOpenId] = useState<string | undefined>(undefined);

  const drawers = useQuery({
    queryKey: ['drawers'],
    enabled: can('drawers:read'),
    queryFn: async () => unwrap(await api.GET('/v1/admin/drawers')),
  });

  const list = usePaged({
    name: 'bookings',
    filters: [{ status, drawerId, applied }],
    fetchPage: async (cursor, limit) =>
      unwrap(
        await api.GET('/v1/admin/bookings', {
          params: {
            query: {
              limit,
              ...(status !== '' && { status: status as (typeof STATUS_OPTIONS)[number] }),
              ...(drawerId !== '' && { drawerId }),
              ...(applied !== '' && { q: applied }),
              ...(cursor !== undefined && { cursor: cursor }),
            },
          },
        }),
      ),
  });

  const rows = list.rows;

  return (
    <div className="grid gap-4">
      <PageHeader title="Bookings" description="Every booking, newest first." />

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied(search.trim());
        }}
      >
        <div className="grid gap-1.5">
          <label htmlFor="status-filter" className="text-sm font-medium">
            Status
          </label>
          <Select id="status-filter" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </Select>
        </div>
        {drawers.data && drawers.data.length > 1 && (
          <div className="grid gap-1.5">
            <label htmlFor="drawer-filter" className="text-sm font-medium">
              Drawer
            </label>
            <Select
              id="drawer-filter"
              value={drawerId}
              onChange={(e) => setDrawerId(e.target.value)}
            >
              <option value="">All drawers</option>
              {drawers.data.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <TextField
          label="Search"
          hint="Customer email or name, asset code or booking id"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-64"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {list.isPending && <Loading />}
      {list.isError && <ErrorNote error={list.error} onRetry={() => void list.refetch()} />}
      {list.isSuccess && rows.length === 0 && (
        <EmptyState
          title="No bookings match"
          hint="Change the filters, or wait for the first booking."
        />
      )}
      {rows.length > 0 && (
        <Table aria-label="Bookings">
          <THead>
            <Tr>
              <Th>Status</Th>
              <Th>Customer</Th>
              <Th>Item</Th>
              <Th>Starts</Th>
              <Th>Length</Th>
              <Th className="text-right">Total</Th>
              <Th>
                <span className="sr-only">Open</span>
              </Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((b) => (
              <Tr key={b.id}>
                <Td>
                  <StatusBadge status={b.status} />
                </Td>
                <Td>{b.customer.email ?? b.customer.id}</Td>
                <Td>
                  {b.itemModel.name}
                  <div className="text-xs text-muted-foreground">
                    {b.assetCode} · {b.drawer.name}
                  </div>
                </Td>
                <Td>{formatDateTime(b.startsAt, b.drawer.timezone)}</Td>
                <Td>{formatDuration(b.durationMinutes)}</Td>
                <Td className="text-right tabular-nums">{formatPaise(b.totalPaise)}</Td>
                <Td className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Open booking of ${b.customer.email ?? b.customer.id} for ${b.itemModel.name}`}
                    onClick={() => setOpenId(b.id)}
                  >
                    Open
                  </Button>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
      <Pager pager={list} />

      {openId && <BookingDetailModal id={openId} onClose={() => setOpenId(undefined)} />}
    </div>
  );
}

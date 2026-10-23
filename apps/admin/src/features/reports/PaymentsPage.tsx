import { useState } from 'react';
import { useApi } from '@/api/api-provider';
import { unwrap } from '@/api/errors';
import { Pager } from '@/components/pager';
import { EmptyState, ErrorNote, Loading, PageHeader } from '@/components/page';
import { Badge, type Tone } from '@/components/ui/badge';
import { Select } from '@/components/ui/controls';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { usePaged } from '@/lib/use-paged';
import { formatDateTime, formatPaise, humanize } from '@/lib/format';

const STATUSES = ['created', 'captured', 'refunded', 'failed'] as const;
const TONE: Record<string, Tone> = {
  created: 'warning',
  captured: 'success',
  refunded: 'info',
  failed: 'danger',
};

/** Every payment and what was refunded from it, newest first (README §13.1). */
export function PaymentsPage() {
  const api = useApi();
  const [status, setStatus] = useState('');

  const list = usePaged({
    name: 'payments',
    filters: [status],
    fetchPage: async (cursor, limit) =>
      unwrap(
        await api.GET('/v1/admin/payments', {
          params: {
            query: {
              limit,
              ...(status !== '' && { status: status as (typeof STATUSES)[number] }),
              ...(cursor !== undefined && { cursor: cursor }),
            },
          },
        }),
      ),
  });
  const rows = list.rows;

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Payments"
        description="What customers paid and what was refunded. Refunds follow the cancellation policy and are sent to the gateway automatically."
      />
      <div className="grid w-48 gap-1.5">
        <label htmlFor="payment-status" className="text-sm font-medium">
          Status
        </label>
        <Select id="payment-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </Select>
      </div>

      {list.isPending && <Loading />}
      {list.isError && <ErrorNote error={list.error} onRetry={() => void list.refetch()} />}
      {list.isSuccess && rows.length === 0 && <EmptyState title="No payments match" />}
      {rows.length > 0 && (
        <Table aria-label="Payments">
          <THead>
            <Tr>
              <Th>When</Th>
              <Th>Customer</Th>
              <Th>Drawer</Th>
              <Th>Gateway</Th>
              <Th>Status</Th>
              <Th className="text-right">Amount</Th>
              <Th className="text-right">Refunded</Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((p) => (
              <Tr key={p.id}>
                <Td>{formatDateTime(p.createdAt)}</Td>
                <Td>
                  {p.customer ?? '—'}
                  {p.extension && <div className="text-xs text-muted-foreground">Extension</div>}
                </Td>
                <Td>{p.drawerName}</Td>
                <Td>{p.provider === 'fake' ? 'Demo gateway' : humanize(p.provider)}</Td>
                <Td>
                  <Badge tone={TONE[p.status] ?? 'neutral'}>{humanize(p.status)}</Badge>
                </Td>
                <Td className="text-right tabular-nums">{formatPaise(p.amountPaise)}</Td>
                <Td className="text-right tabular-nums">
                  {p.refundedPaise === null ? (
                    '—'
                  ) : (
                    <>
                      {formatPaise(p.refundedPaise)}
                      <div className="text-xs text-muted-foreground">
                        {humanize(p.refundStatus ?? '')}
                      </div>
                    </>
                  )}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
      <Pager pager={list} />
    </div>
  );
}

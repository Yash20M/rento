import { Fragment, useState } from 'react';
import { useApi } from '@/api/api-provider';
import { unwrap } from '@/api/errors';
import { Pager } from '@/components/pager';
import { EmptyState, ErrorNote, Loading, PageHeader } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Select, TextField } from '@/components/ui/controls';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { usePaged } from '@/lib/use-paged';
import { formatDateTime } from '@/lib/format';

const ENTITY_TYPES = [
  'booking',
  'role',
  'admin',
  'invitation',
  'drawer',
  'category',
  'item_model',
  'asset',
];

/** Who did what, when and why — newest first. Read-only: the trail cannot be changed from anywhere. */
export function AuditPage() {
  const api = useApi();
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [entityId, setEntityId] = useState('');
  const [applied, setApplied] = useState({ action: '', entityId: '' });
  const [open, setOpen] = useState<string | undefined>(undefined);

  const list = usePaged({
    name: 'audit',
    filters: [entityType, applied],
    fetchPage: async (cursor, limit) =>
      unwrap(
        await api.GET('/v1/admin/audit-logs', {
          params: {
            query: {
              limit,
              ...(entityType !== '' && { entityType }),
              ...(applied.action !== '' && { action: applied.action }),
              ...(applied.entityId !== '' && { entityId: applied.entityId }),
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
        title="Audit log"
        description="Every change made by staff, with who, when and why."
      />
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied({ action: action.trim(), entityId: entityId.trim() });
        }}
      >
        <div className="grid gap-1.5">
          <label htmlFor="audit-entity" className="text-sm font-medium">
            About
          </label>
          <Select
            id="audit-entity"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          >
            <option value="">Everything</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace('_', ' ')}
              </option>
            ))}
          </Select>
        </div>
        <TextField
          label="Action"
          hint="For example booking. or booking.cancelled"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        />
        <TextField
          label="Record id"
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
        />
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {list.isPending && <Loading />}
      {list.isError && <ErrorNote error={list.error} onRetry={() => void list.refetch()} />}
      {list.isSuccess && rows.length === 0 && (
        <EmptyState title="Nothing recorded for these filters" />
      )}
      {rows.length > 0 && (
        <Table aria-label="Audit log">
          <THead>
            <Tr>
              <Th>When</Th>
              <Th>Who</Th>
              <Th>What</Th>
              <Th>Why</Th>
              <Th>
                <span className="sr-only">Details</span>
              </Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((entry) => (
              <Fragment key={entry.id}>
                <Tr>
                  <Td className="whitespace-nowrap">{formatDateTime(entry.at)}</Td>
                  <Td>{entry.actor ? (entry.actor.email ?? entry.actor.id) : <em>system</em>}</Td>
                  <Td>
                    <span className="font-medium">{entry.action}</span>
                    <div className="text-xs text-muted-foreground">
                      {entry.entityType}
                      {entry.entityId ? ` ${entry.entityId.slice(0, 8)}…` : ''}
                    </div>
                  </Td>
                  <Td className="text-muted-foreground">{entry.reason ?? '—'}</Td>
                  <Td className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-expanded={open === entry.id}
                      onClick={() => setOpen(open === entry.id ? undefined : entry.id)}
                    >
                      {open === entry.id ? 'Hide' : 'Details'}
                    </Button>
                  </Td>
                </Tr>
                {open === entry.id && (
                  <Tr>
                    <Td colSpan={5} className="bg-muted/40">
                      <div className="grid gap-3 text-xs sm:grid-cols-2">
                        <div>
                          <p className="mb-1 font-medium">Before</p>
                          <pre className="overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(entry.before, null, 2) ?? '—'}
                          </pre>
                        </div>
                        <div>
                          <p className="mb-1 font-medium">After</p>
                          <pre className="overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(entry.after, null, 2) ?? '—'}
                          </pre>
                        </div>
                      </div>
                    </Td>
                  </Tr>
                )}
              </Fragment>
            ))}
          </TBody>
        </Table>
      )}
      <Pager pager={list} />
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useApi } from '@/api/api-provider';
import { fieldErrors, unwrap } from '@/api/errors';
import { useAuth } from '@/auth/auth-context';
import { Pager } from '@/components/pager';
import { EmptyState, ErrorNote, Loading, PageHeader } from '@/components/page';
import { Avatar, EmailState, VerifiedTick } from '@/components/ui/avatar';
import { Badge, type Tone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Select, Textarea, TextField } from '@/components/ui/controls';
import { Modal } from '@/components/ui/modal';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { usePaged } from '@/lib/use-paged';
import { formatDateTime } from '@/lib/format';

const KYC = ['none', 'pending', 'verified', 'rejected'] as const;
const LABEL: Record<string, string> = {
  none: 'Not verified',
  pending: 'In progress',
  verified: 'Verified',
  rejected: 'Declined',
};
const TONE: Record<string, Tone> = {
  none: 'neutral',
  pending: 'warning',
  verified: 'success',
  rejected: 'danger',
};

export const KycBadge = ({ status }: { status: string }) => (
  <Badge tone={TONE[status] ?? 'neutral'}>{LABEL[status] ?? status}</Badge>
);

/** People who use Rento and whether they have verified their identity (Aadhaar) — required before booking. */
export function CustomersPage() {
  const api = useApi();
  const [kyc, setKyc] = useState('');
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [openId, setOpenId] = useState<string | undefined>(undefined);

  const list = usePaged({
    name: 'customers',
    filters: [{ kyc, applied }],
    fetchPage: async (cursor, limit) =>
      unwrap(
        await api.GET('/v1/admin/customers', {
          params: {
            query: {
              limit,
              ...(kyc !== '' && { kyc: kyc as (typeof KYC)[number] }),
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
      <PageHeader
        title="Customers"
        description="Everyone who has an account. Customers must verify their identity with Aadhaar before they can book."
      />
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(search.trim());
        }}
      >
        <div className="grid gap-1.5">
          <label htmlFor="kyc-filter" className="text-sm font-medium">
            Identity
          </label>
          <Select id="kyc-filter" value={kyc} onChange={(e) => setKyc(e.target.value)}>
            <option value="">Any</option>
            {KYC.map((s) => (
              <option key={s} value={s}>
                {LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
        <TextField
          label="Search"
          hint="Email or name"
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
      {list.isSuccess && rows.length === 0 && <EmptyState title="No customers match" />}
      {rows.length > 0 && (
        <Table aria-label="Customers">
          <THead>
            <Tr>
              <Th>Customer</Th>
              <Th>Identity</Th>
              <Th>Aadhaar</Th>
              <Th className="text-right">Bookings</Th>
              <Th>Joined</Th>
              <Th>
                <span className="sr-only">Open</span>
              </Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((c) => (
              <Tr key={c.id}>
                <Td className="font-medium">
                  <div className="flex items-center gap-3">
                    <Avatar name={c.name ?? c.email ?? '?'} src={c.avatarUrl} />
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-1.5">
                        {c.name ?? c.email ?? c.id}
                        {c.kycStatus === 'verified' && <VerifiedTick />}
                      </span>
                      {c.name && c.email && (
                        <div className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                          {c.email}
                          <EmailState verified={c.emailVerified} />
                        </div>
                      )}
                    </div>
                  </div>
                </Td>
                <Td>
                  <KycBadge status={c.kycStatus} />
                </Td>
                <Td className="text-muted-foreground">{c.maskedAadhaar ?? '—'}</Td>
                <Td className="text-right tabular-nums">{c.bookingCount}</Td>
                <Td>{formatDateTime(c.createdAt)}</Td>
                <Td className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Open ${c.email ?? c.name ?? c.id}`}
                    onClick={() => setOpenId(c.id)}
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
      {openId && <CustomerModal id={openId} onClose={() => setOpenId(undefined)} />}
    </div>
  );
}

function CustomerModal({ id, onClose }: { id: string; onClose: () => void }) {
  const api = useApi();
  const { can } = useAuth();
  const [deciding, setDeciding] = useState<'approve' | 'reject' | 'reset' | undefined>(undefined);
  const [suspending, setSuspending] = useState(false);
  const query = useQuery({
    queryKey: ['customer', id],
    queryFn: async () =>
      unwrap(await api.GET('/v1/admin/customers/{id}', { params: { path: { id } } })),
  });
  const c = query.data;

  return (
    <Modal
      title={c?.name ?? c?.email ?? 'Customer'}
      description={c?.email ?? undefined}
      onClose={onClose}
    >
      {query.isPending && <Loading />}
      {query.isError && <ErrorNote error={query.error} onRetry={() => void query.refetch()} />}
      {c && (
        <div className="grid gap-4 text-sm">
          <div className="flex items-center gap-3">
            <Avatar name={c.name ?? c.email ?? '?'} src={c.avatarUrl} size={56} />
            <div className="flex flex-wrap items-center gap-2">
              {c.kycStatus === 'verified' && <VerifiedTick />}
              <EmailState verified={c.emailVerified} />
              <span className="text-xs text-muted-foreground">
                {c.emailVerified ? 'Email verified' : 'Email not verified'}
              </span>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-y-2">
            <dt className="text-muted-foreground">Identity</dt>
            <dd className="col-span-2">
              <KycBadge status={c.kycStatus} />
            </dd>
            <dt className="text-muted-foreground">Account</dt>
            <dd className="col-span-2">
              {c.accountStatus === 'suspended' ? (
                <Badge tone="danger">Suspended</Badge>
              ) : (
                <Badge tone="success">Active</Badge>
              )}
            </dd>
            <dt className="text-muted-foreground">Aadhaar</dt>
            <dd className="col-span-2">{c.kyc.maskedAadhaar ?? '—'}</dd>
            {c.kyc.verifiedName && (
              <>
                <dt className="text-muted-foreground">Name on record</dt>
                <dd className="col-span-2">{c.kyc.verifiedName}</dd>
              </>
            )}
            {c.kyc.verifiedAt && (
              <>
                <dt className="text-muted-foreground">Verified</dt>
                <dd className="col-span-2">{formatDateTime(c.kyc.verifiedAt)}</dd>
              </>
            )}
            {c.kyc.reason && (
              <>
                <dt className="text-muted-foreground">Staff note</dt>
                <dd className="col-span-2">{c.kyc.reason}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Bookings</dt>
            <dd className="col-span-2">
              {c.bookingCount} in total, {c.activeBookings} active
            </dd>
          </dl>
          {can('users:write') && (
            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              {c.kycStatus !== 'verified' && (
                <Button onClick={() => setDeciding('approve')}>Approve by hand…</Button>
              )}
              {c.kycStatus !== 'rejected' && (
                <Button variant="destructive" onClick={() => setDeciding('reject')}>
                  Decline…
                </Button>
              )}
              <Button
                variant={c.accountStatus === 'suspended' ? 'outline' : 'destructive'}
                onClick={() => setSuspending(true)}
              >
                {c.accountStatus === 'suspended' ? 'Reinstate account…' : 'Suspend account…'}
              </Button>
              {c.kycStatus !== 'none' && c.kycStatus !== 'pending' && (
                <Button variant="outline" onClick={() => setDeciding('reset')}>
                  Reset…
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      {suspending && c && (
        <SuspendDialog
          id={id}
          suspended={c.accountStatus === 'suspended'}
          onClose={() => setSuspending(false)}
        />
      )}
      {deciding && c && (
        <DecisionDialog id={id} decision={deciding} onClose={() => setDeciding(undefined)} />
      )}
    </Modal>
  );
}

const COPY = {
  approve: {
    title: 'Approve identity by hand',
    hint: 'Use this after checking the original card in person. The customer can book straight away.',
    action: 'Approve',
  },
  reject: {
    title: 'Decline identity',
    hint: 'The customer cannot book and cannot retry on their own until you reset it.',
    action: 'Decline',
  },
  reset: {
    title: 'Reset verification',
    hint: 'Forgets the result so the customer can verify again.',
    action: 'Reset',
  },
} as const;

function DecisionDialog({
  id,
  decision,
  onClose,
}: {
  id: string;
  decision: 'approve' | 'reject' | 'reset';
  onClose: () => void;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const save = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST('/v1/admin/customers/{id}/kyc', {
          params: { path: { id } },
          body: { decision, reason: reason.trim() },
        }),
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['customer', id] }),
        queryClient.invalidateQueries({ queryKey: ['customers'] }),
      ]);
      onClose();
    },
  });
  const problems = fieldErrors(save.error);
  const copy = COPY[decision];

  function submit(event: FormEvent) {
    event.preventDefault();
    if (reason.trim().length >= 3) save.mutate();
  }

  return (
    <Modal
      title={copy.title}
      description={copy.hint}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="kyc-decision"
            variant={decision === 'reject' ? 'destructive' : 'default'}
            disabled={save.isPending || reason.trim().length < 3}
          >
            {copy.action}
          </Button>
        </>
      }
    >
      <form id="kyc-decision" className="grid gap-3" onSubmit={submit} noValidate>
        <Field
          label="Reason"
          hint="Kept in the audit log (at least 3 characters)."
          error={problems['reason']}
        >
          {(aria) => (
            <Textarea
              {...aria}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
            />
          )}
        </Field>
        <ErrorNote
          error={save.error && Object.keys(problems).length === 0 ? save.error : undefined}
        />
      </form>
    </Modal>
  );
}

function SuspendDialog({
  id,
  suspended,
  onClose,
}: {
  id: string;
  suspended: boolean;
  onClose: () => void;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const save = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST('/v1/admin/customers/{id}/status', {
          params: { path: { id } },
          body: { status: suspended ? 'active' : 'suspended', reason: reason.trim() },
        }),
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['customer', id] }),
        queryClient.invalidateQueries({ queryKey: ['customers'] }),
      ]);
      onClose();
    },
  });
  const problems = fieldErrors(save.error);
  return (
    <Modal
      title={suspended ? 'Reinstate this account' : 'Suspend this account'}
      description={
        suspended
          ? 'The customer can sign in and book again.'
          : 'The customer is signed out everywhere and cannot book. Bookings already made are not touched.'
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="suspend-form"
            variant={suspended ? 'default' : 'destructive'}
            disabled={save.isPending || reason.trim().length < 3}
          >
            {suspended ? 'Reinstate' : 'Suspend'}
          </Button>
        </>
      }
    >
      <form
        id="suspend-form"
        className="grid gap-3"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (reason.trim().length >= 3) save.mutate();
        }}
      >
        <Field
          label="Reason"
          hint="Kept in the audit log (at least 3 characters)."
          error={problems['reason']}
        >
          {(aria) => (
            <Textarea
              {...aria}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
            />
          )}
        </Field>
        <ErrorNote
          error={save.error && Object.keys(problems).length === 0 ? save.error : undefined}
        />
      </form>
    </Modal>
  );
}

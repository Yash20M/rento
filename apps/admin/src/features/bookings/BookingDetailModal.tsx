import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useApi } from '@/api/api-provider';
import { fieldErrors, unwrap } from '@/api/errors';
import type { AdminBookingDetail } from '@/api/types';
import { useAuth } from '@/auth/auth-context';
import { ErrorNote, Loading } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Textarea, TextField } from '@/components/ui/controls';
import { Modal } from '@/components/ui/modal';
import { formatDateTime, formatDuration, formatPaise, humanize } from '@/lib/format';
import { ReassignDialog } from './ReassignDialog';
import { StatusBadge, statusLabel } from './status';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-span-2">{children}</dd>
    </div>
  );
}

export function BookingDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [cancelling, setCancelling] = useState(false);
  const [moving, setMoving] = useState(false);

  const query = useQuery({
    queryKey: ['booking', id],
    queryFn: async () =>
      unwrap(await api.GET('/v1/admin/bookings/{id}', { params: { path: { id } } })),
  });

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['booking', id] }),
      queryClient.invalidateQueries({ queryKey: ['bookings'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['schedule'] }),
    ]);

  const handOver = useMutation({
    mutationFn: async (action: 'pickup' | 'return') =>
      unwrap(
        await api.POST(
          action === 'pickup' ? '/v1/admin/bookings/{id}/pickup' : '/v1/admin/bookings/{id}/return',
          { params: { path: { id } } },
        ),
      ),
    onSuccess: refresh,
  });

  const b = query.data;
  return (
    <Modal
      title="Booking"
      description={b ? `${b.itemModel.name} · ${b.assetCode}` : undefined}
      onClose={onClose}
      wide
    >
      {query.isPending && <Loading />}
      {query.isError && <ErrorNote error={query.error} onRetry={() => void query.refetch()} />}
      {b && (
        <div className="grid gap-5">
          <dl className="divide-y">
            <Row label="Status">
              <StatusBadge status={b.status} />
              {b.cancelReason && (
                <span className="ml-2 text-muted-foreground">Reason: {b.cancelReason}</span>
              )}
            </Row>
            <Row label="Customer">{b.customer.email ?? b.customer.id}</Row>
            <Row label="Drawer">
              {b.drawer.name}
              <div className="text-xs text-muted-foreground">{b.drawer.address}</div>
            </Row>
            <Row label="When">
              {formatDateTime(b.startsAt, b.drawer.timezone)} →{' '}
              {formatDateTime(b.endsAt, b.drawer.timezone)}
              <div className="text-xs text-muted-foreground">
                {formatDuration(b.durationMinutes)} · times in {b.drawer.timezone}
              </div>
            </Row>
            <Row label="Price">
              {formatPaise(b.pricePaise)} rental + {formatPaise(b.depositPaise)} deposit ={' '}
              <strong>{formatPaise(b.totalPaise)}</strong>
            </Row>
            <Row label="Payment">
              {b.payment
                ? `${humanize(b.payment.status)} · ${formatPaise(b.payment.amountPaise)}`
                : 'No payment yet'}
            </Row>
            {b.refund && (
              <Row label="Refund">
                {formatPaise(b.refund.amountPaise)} · {humanize(b.refund.status)}
              </Row>
            )}
          </dl>

          <section aria-labelledby="history-heading">
            <h3 id="history-heading" className="mb-2 text-sm font-medium">
              History
            </h3>
            <ol className="grid gap-1.5 text-sm">
              {b.history.map((h, index) => (
                <li key={`${h.at}-${index}`} className="flex flex-wrap gap-x-2">
                  <time className="text-muted-foreground" dateTime={h.at}>
                    {formatDateTime(h.at)}
                  </time>
                  <span>
                    {h.from ? `${statusLabel(h.from)} → ` : ''}
                    <strong>{statusLabel(h.to)}</strong>
                    {h.note ? ` — ${h.note}` : ''}
                    {h.actorUserId === null ? ' (automatic)' : ''}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <ErrorNote error={handOver.error} />
          <Actions
            booking={b}
            busy={handOver.isPending}
            onHandOver={(action) => handOver.mutate(action)}
            onCancel={() => setCancelling(true)}
            onMove={() => setMoving(true)}
          />
        </div>
      )}
      {moving && b && (
        <ReassignDialog
          bookingId={b.id}
          onClose={() => setMoving(false)}
          onDone={() => {
            setMoving(false);
            void refresh();
          }}
        />
      )}
      {cancelling && b && (
        <CancelDialog
          booking={b}
          onClose={() => setCancelling(false)}
          onDone={() => {
            setCancelling(false);
            void refresh();
          }}
        />
      )}
    </Modal>
  );
}

function Actions({
  booking,
  busy,
  onHandOver,
  onCancel,
  onMove,
}: {
  booking: AdminBookingDetail;
  busy: boolean;
  onHandOver: (action: 'pickup' | 'return') => void;
  onCancel: () => void;
  onMove: () => void;
}) {
  const { can } = useAuth();
  const drawerId = booking.drawer.id;
  const showPickup = booking.status === 'confirmed' && can('bookings:write', drawerId);
  const showReturn =
    (booking.status === 'active' || booking.status === 'overdue') &&
    can('bookings:write', drawerId);
  const showCancel = booking.cancellable && can('bookings:cancel', drawerId);
  const showMove =
    (booking.status === 'confirmed' || booking.status === 'held') &&
    can('bookings:write', drawerId);
  if (!showPickup && !showReturn && !showCancel && !showMove) return null;
  return (
    <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
      {showMove && (
        <Button variant="outline" onClick={onMove} disabled={busy}>
          Move to another unit…
        </Button>
      )}
      {showCancel && (
        <Button variant="destructive" onClick={onCancel} disabled={busy}>
          Cancel booking…
        </Button>
      )}
      {showPickup && (
        <Button onClick={() => onHandOver('pickup')} disabled={busy}>
          Hand over to customer
        </Button>
      )}
      {showReturn && (
        <Button onClick={() => onHandOver('return')} disabled={busy}>
          Take back
        </Button>
      )}
    </div>
  );
}

function CancelDialog({
  booking,
  onClose,
  onDone,
}: {
  booking: AdminBookingDetail;
  onClose: () => void;
  onDone: () => void;
}) {
  const api = useApi();
  const { can } = useAuth();
  const [reason, setReason] = useState('');
  const [override, setOverride] = useState(false);
  const [percent, setPercent] = useState('100');
  const canOverride =
    can('bookings:refund', booking.drawer.id) && booking.payment?.status === 'captured';

  const cancel = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST('/v1/admin/bookings/{id}/cancel', {
          params: { path: { id: booking.id } },
          body: { reason: reason.trim(), ...(override && { refundPercent: Number(percent) }) },
        }),
      ),
    onSuccess: onDone,
  });

  const problems = fieldErrors(cancel.error);
  const reasonTooShort = reason.trim().length < 3;
  const percentValid = /^\d{1,3}$/.test(percent) && Number(percent) <= 100;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!reasonTooShort && (!override || percentValid)) cancel.mutate();
  }

  return (
    <Modal
      title="Cancel this booking?"
      description="The customer is refunded by the cancellation policy unless you override it. This cannot be undone."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={cancel.isPending}>
            Keep booking
          </Button>
          <Button
            variant="destructive"
            form="cancel-form"
            type="submit"
            disabled={cancel.isPending || reasonTooShort || (override && !percentValid)}
          >
            Cancel booking
          </Button>
        </>
      }
    >
      <form id="cancel-form" className="grid gap-4" onSubmit={submit} noValidate>
        <Field
          label="Reason"
          hint="Shown in the audit log (at least 3 characters)."
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
        {canOverride && (
          <div className="grid gap-2">
            <Checkbox
              label="Override the refund percentage"
              checked={override}
              onChange={(e) => setOverride(e.target.checked)}
            />
            {override && (
              <TextField
                label="Refund percentage of the rental price (0–100)"
                hint="The deposit is always returned in full."
                inputMode="numeric"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                error={problems['refundPercent']}
              />
            )}
          </div>
        )}
        <ErrorNote error={cancel.error} />
      </form>
    </Modal>
  );
}

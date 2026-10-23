import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useApi } from '@/api/api-provider';
import { fieldErrors, unwrap } from '@/api/errors';
import type { ScheduleAsset } from '@/api/types';
import { useAuth } from '@/auth/auth-context';
import { ErrorNote, Loading } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Field, Select, Textarea, TextField } from '@/components/ui/controls';
import { Modal } from '@/components/ui/modal';
import { formatDateTime, humanize, zonedLocalToIso } from '@/lib/format';

/**
 * Takes a unit out of service for a time. The preview names the bookings in the way FIRST; nothing is cancelled or
 * moved for you — resolve them (move or cancel) and come back.
 */
export function BlockDialog({
  asset,
  timeZone,
  day,
  onClose,
}: {
  asset: ScheduleAsset;
  timeZone: string;
  day: string;
  onClose: () => void;
}) {
  const api = useApi();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(`${day}T10:00`);
  const [to, setTo] = useState(`${day}T12:00`);
  const [kind, setKind] = useState<'maintenance' | 'admin_block'>('maintenance');
  const [reason, setReason] = useState('');

  const startsAt = zonedLocalToIso(from, timeZone);
  const endsAt = zonedLocalToIso(to, timeZone);
  const validRange = startsAt !== undefined && endsAt !== undefined && endsAt > startsAt;

  const preview = useQuery({
    queryKey: ['impact', asset.assetId, startsAt, endsAt],
    enabled: validRange && can('bookings:read'),
    retry: false,
    queryFn: async () =>
      unwrap(
        await api.GET('/v1/admin/assets/{id}/impact-preview', {
          params: { path: { id: asset.assetId }, query: { startsAt: startsAt!, endsAt: endsAt! } },
        }),
      ),
  });

  const create = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST('/v1/admin/assets/{id}/blocks', {
          params: { path: { id: asset.assetId } },
          body: { startsAt: startsAt!, endsAt: endsAt!, reason: reason.trim(), kind },
        }),
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['schedule'] }),
        queryClient.invalidateQueries({ queryKey: ['impact'] }),
      ]);
      onClose();
    },
  });
  const problems = fieldErrors(create.error);
  const reasonTooShort = reason.trim().length < 3;
  const blocked = preview.data !== undefined && !preview.data.clear;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (validRange && !reasonTooShort && !blocked) create.mutate();
  }

  return (
    <Modal
      title={`Block ${asset.assetCode}`}
      description={`${asset.itemModel}. Times are in ${timeZone}.`}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="block-form"
            disabled={create.isPending || !validRange || reasonTooShort || blocked}
          >
            Block this time
          </Button>
        </>
      }
    >
      <form id="block-form" className="grid gap-4" onSubmit={submit} noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="From"
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            error={problems['startsAt']}
          />
          <TextField
            label="Until"
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            error={problems['endsAt'] ?? (validRange ? undefined : 'Must be after the start')}
          />
        </div>
        <Field label="Kind">
          {(aria) => (
            <Select
              {...aria}
              value={kind}
              onChange={(e) => setKind(e.target.value as 'maintenance' | 'admin_block')}
            >
              <option value="maintenance">Maintenance</option>
              <option value="admin_block">Other (keep out of service)</option>
            </Select>
          )}
        </Field>
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

        {preview.isFetching && <Loading label="Checking what is in the way…" />}
        {preview.data?.clear && (
          <p role="status" className="text-sm text-success">
            Nothing is booked in this time. It can be blocked.
          </p>
        )}
        {blocked && preview.data && (
          <div
            role="alert"
            className="grid gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
          >
            <p className="font-medium text-destructive">
              This time cannot be blocked yet. Nothing is cancelled for you.
            </p>
            <ul className="grid gap-1">
              {preview.data.bookings.map((b) => (
                <li key={b.bookingId}>
                  {b.customer ?? 'A customer'} · {humanize(b.status)} ·{' '}
                  {formatDateTime(b.startsAt, timeZone)} – {formatDateTime(b.endsAt, timeZone)}
                </li>
              ))}
              {preview.data.blocks.map((b) => (
                <li key={b.id}>
                  Already blocked ({humanize(b.kind)}) · {formatDateTime(b.startsAt, timeZone)} –{' '}
                  {formatDateTime(b.endsAt, timeZone)}
                </li>
              ))}
            </ul>
            {preview.data.bookings.length > 0 && (
              <p className="text-muted-foreground">
                Move those bookings to another unit (open them from the schedule) or cancel them,
                then block.
              </p>
            )}
          </div>
        )}
        {preview.isError && <ErrorNote error={preview.error} />}
        <ErrorNote
          error={
            create.error && !(problems['startsAt'] || problems['endsAt'] || problems['reason'])
              ? create.error
              : undefined
          }
        />
      </form>
    </Modal>
  );
}

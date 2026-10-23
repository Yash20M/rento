import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useApi } from '@/api/api-provider';
import { fieldErrors, unwrap } from '@/api/errors';
import type { Asset } from '@/api/types';
import { ErrorNote, Loading } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Field, Select, Textarea } from '@/components/ui/controls';
import { Modal } from '@/components/ui/modal';
import { useDrawers } from '../drawers/DrawersPage';

/** Moves a unit to another drawer: start (it leaves service), then receive it there — or cancel and it stays put. */
export function TransferDialog({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const drawers = useDrawers();
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');

  const current = useQuery({
    queryKey: ['transfer', asset.id],
    queryFn: async () =>
      unwrap(
        await api.GET('/v1/admin/assets/{id}/transfer', { params: { path: { id: asset.id } } }),
      ),
  });
  const inTransit = current.data ?? undefined;
  const nameOf = (id: string) => drawers.data?.find((d) => d.id === id)?.name ?? id;

  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: ['assets'] });
    await queryClient.invalidateQueries({ queryKey: ['transfer', asset.id] });
    onClose();
  };
  const start = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST('/v1/admin/assets/{id}/transfer', {
          params: { path: { id: asset.id } },
          body: { toDrawerId: to, reason: reason.trim() },
        }),
      ),
    onSuccess: done,
  });
  const finish = useMutation({
    mutationFn: async (how: 'complete' | 'cancel') =>
      unwrap(
        await api.POST(
          how === 'complete'
            ? '/v1/admin/assets/{id}/transfer/complete'
            : '/v1/admin/assets/{id}/transfer/cancel',
          { params: { path: { id: asset.id } } },
        ),
      ),
    onSuccess: done,
  });
  const problems = fieldErrors(start.error);
  const busy = start.isPending || finish.isPending;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (to !== '' && reason.trim().length >= 3) start.mutate();
  }

  return (
    <Modal
      title={`Transfer ${asset.assetCode}`}
      description={`${asset.itemModelName} · now in ${asset.drawerName}`}
      onClose={onClose}
      footer={
        inTransit ? (
          <>
            <Button variant="outline" onClick={() => finish.mutate('cancel')} disabled={busy}>
              Cancel transfer
            </Button>
            <Button onClick={() => finish.mutate('complete')} disabled={busy}>
              Received at {nameOf(inTransit.toDrawerId)}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Close
            </Button>
            <Button
              type="submit"
              form="transfer-form"
              disabled={busy || to === '' || reason.trim().length < 3 || current.isPending}
            >
              Start transfer
            </Button>
          </>
        )
      }
    >
      {current.isPending && <Loading />}
      {current.isError && (
        <ErrorNote error={current.error} onRetry={() => void current.refetch()} />
      )}
      {inTransit && (
        <p role="status" className="text-sm">
          On its way from <strong>{nameOf(inTransit.fromDrawerId)}</strong> to{' '}
          <strong>{nameOf(inTransit.toDrawerId)}</strong> ({inTransit.reason}). It cannot be booked
          until it is received or the transfer is cancelled.
        </p>
      )}
      {current.isSuccess && !inTransit && (
        <form id="transfer-form" className="grid gap-4" onSubmit={submit} noValidate>
          <p className="text-sm text-muted-foreground">
            The unit leaves service right away. A unit with upcoming bookings or blocks cannot be
            moved: resolve those first.
          </p>
          <Field label="Move to" error={problems['toDrawerId']}>
            {(aria) => (
              <Select {...aria} value={to} onChange={(e) => setTo(e.target.value)}>
                <option value="">Choose a drawer…</option>
                {(drawers.data ?? [])
                  .filter((d) => d.id !== asset.drawerId)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
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
        </form>
      )}
      <ErrorNote
        className="mt-3"
        error={
          finish.error ??
          (start.error && !(problems['toDrawerId'] || problems['reason']) ? start.error : undefined)
        }
      />
    </Modal>
  );
}

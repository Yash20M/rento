import { useMutation, useQuery } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useApi } from '@/api/api-provider';
import { fieldErrors, unwrap } from '@/api/errors';
import { ErrorNote, Loading } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Field, Select, Textarea } from '@/components/ui/controls';
import { Modal } from '@/components/ui/modal';

/** Moves a booking that has not started to another unit of the same model. Time and price do not change. */
export function ReassignDialog({
  bookingId,
  onClose,
  onDone,
}: {
  bookingId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const api = useApi();
  const [assetId, setAssetId] = useState('');
  const [reason, setReason] = useState('');

  const options = useQuery({
    queryKey: ['reassign-options', bookingId],
    queryFn: async () =>
      unwrap(
        await api.GET('/v1/admin/bookings/{id}/reassign-options', {
          params: { path: { id: bookingId } },
        }),
      ),
  });

  const move = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST('/v1/admin/bookings/{id}/reassign', {
          params: { path: { id: bookingId } },
          body: { reason: reason.trim(), ...(assetId !== '' && { assetId }) },
        }),
      ),
    onSuccess: onDone,
  });
  const problems = fieldErrors(move.error);
  const free = options.data ?? [];
  const reasonTooShort = reason.trim().length < 3;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!reasonTooShort) move.mutate();
  }

  return (
    <Modal
      title="Move to another unit"
      description="The customer keeps the same time and price. Only the physical unit changes."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={move.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="reassign-form"
            disabled={move.isPending || reasonTooShort || free.length === 0}
          >
            Move booking
          </Button>
        </>
      }
    >
      {options.isPending && <Loading />}
      {options.isError && (
        <ErrorNote error={options.error} onRetry={() => void options.refetch()} />
      )}
      {options.isSuccess && free.length === 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          No other unit of this model is free for this time.
        </p>
      )}
      {free.length > 0 && (
        <form id="reassign-form" className="grid gap-4" onSubmit={submit} noValidate>
          <Field label="Move to" error={problems['assetId']}>
            {(aria) => (
              <Select {...aria} value={assetId} onChange={(e) => setAssetId(e.target.value)}>
                <option value="">Any free unit</option>
                {free.map((o) => (
                  <option key={o.assetId} value={o.assetId}>
                    {o.assetCode}
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
          <ErrorNote
            error={move.error && Object.keys(problems).length === 0 ? move.error : undefined}
          />
        </form>
      )}
    </Modal>
  );
}

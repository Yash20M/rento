import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useApi } from '@/api/api-provider';
import { fieldErrors, unwrap } from '@/api/errors';
import type { Drawer } from '@/api/types';
import { ErrorNote, Loading } from '@/components/page';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/controls';
import { Modal } from '@/components/ui/modal';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { formatDateTime, zonedLocalToIso } from '@/lib/format';

/** Days or hours when a drawer is shut although its weekly hours say open (holiday, repairs). */
export function ClosuresModal({
  drawer,
  writable,
  onClose,
}: {
  drawer: Drawer;
  writable: boolean;
  onClose: () => void;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const key = ['closures', drawer.id];
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [local, setLocal] = useState<Record<string, string>>({});

  const closures = useQuery({
    queryKey: key,
    queryFn: async () =>
      unwrap(
        await api.GET('/v1/admin/drawers/{id}/closures', { params: { path: { id: drawer.id } } }),
      ),
  });

  const add = useMutation({
    mutationFn: async (range: { from: string; to: string }) =>
      unwrap(
        await api.POST('/v1/admin/drawers/{id}/closures', {
          params: { path: { id: drawer.id } },
          body: { ...range, ...(reason.trim() !== '' && { reason: reason.trim() }) },
        }),
      ),
    onSuccess: async () => {
      setFrom('');
      setTo('');
      setReason('');
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });
  const remove = useMutation({
    mutationFn: async (closureId: string) =>
      unwrap(
        await api.DELETE('/v1/admin/drawers/{id}/closures/{closureId}', {
          params: { path: { id: drawer.id, closureId } },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const server = fieldErrors(add.error);
  const problems = { ...server, ...local };

  function submit(event: FormEvent) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    const fromIso = zonedLocalToIso(from, drawer.timezone);
    const toIso = zonedLocalToIso(to, drawer.timezone);
    if (!fromIso) errors['from'] = 'Choose when the closure starts.';
    if (!toIso) errors['to'] = 'Choose when the closure ends.';
    if (fromIso && toIso && toIso <= fromIso) errors['to'] = 'The end must be after the start.';
    setLocal(errors);
    if (fromIso && toIso && Object.keys(errors).length === 0)
      add.mutate({ from: fromIso, to: toIso });
  }

  return (
    <Modal
      title={`Closures — ${drawer.name}`}
      description={`Times are local to the drawer (${drawer.timezone}).`}
      onClose={onClose}
      wide
    >
      <div className="grid gap-5">
        {closures.isPending && <Loading />}
        {closures.isError && (
          <ErrorNote error={closures.error} onRetry={() => void closures.refetch()} />
        )}
        {closures.isSuccess &&
          (closures.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No closures planned.</p>
          ) : (
            <Table aria-label="Closures">
              <THead>
                <Tr>
                  <Th>From</Th>
                  <Th>To</Th>
                  <Th>Reason</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {closures.data.map((c) => (
                  <Tr key={c.id}>
                    <Td>{formatDateTime(c.from, drawer.timezone)}</Td>
                    <Td>{formatDateTime(c.to, drawer.timezone)}</Td>
                    <Td className="text-muted-foreground">{c.reason ?? '—'}</Td>
                    <Td className="text-right">
                      {writable && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(c.id)}
                        >
                          Remove
                        </Button>
                      )}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          ))}
        <ErrorNote error={remove.error} />

        {writable && (
          <form className="grid gap-3 border-t pt-4 sm:grid-cols-2" onSubmit={submit} noValidate>
            <h3 className="text-sm font-medium sm:col-span-2">Add a closure</h3>
            <TextField
              label="From"
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              error={problems['from']}
            />
            <TextField
              label="To"
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              error={problems['to']}
            />
            <TextField
              label="Reason (optional)"
              className="sm:col-span-2"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              error={problems['reason']}
            />
            <ErrorNote
              className="sm:col-span-2"
              error={add.error && Object.keys(server).length === 0 ? add.error : undefined}
            />
            <div className="sm:col-span-2">
              <Button type="submit" disabled={add.isPending}>
                Add closure
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}

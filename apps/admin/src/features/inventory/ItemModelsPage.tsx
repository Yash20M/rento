import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useApi } from '@/api/api-provider';
import { fieldErrors, unwrap } from '@/api/errors';
import type { ItemModel } from '@/api/types';
import { useAuth } from '@/auth/auth-context';
import { EmptyState, ErrorNote, Loading, PageHeader } from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Select, Textarea, TextField } from '@/components/ui/controls';
import { Modal } from '@/components/ui/modal';
import { PendingPhotos, PhotoGallery, uploadPhoto } from './PhotoGallery';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { formatDuration, formatPaise, paiseToRupees, rupeesToPaise } from '@/lib/format';
import { useCategories } from './CategoriesPage';

export function useItemModels() {
  const api = useApi();
  const { can } = useAuth();
  return useQuery({
    queryKey: ['item-models'],
    enabled: can('inventory:read'),
    queryFn: async () =>
      unwrap(
        await api.GET('/v1/admin/item-models', { params: { query: { includeInactive: true } } }),
      ),
  });
}

export function ItemModelsPage() {
  const { can } = useAuth();
  const writable = can('inventory:write');
  const models = useItemModels();
  const categories = useCategories();
  const [editing, setEditing] = useState<ItemModel | 'new' | undefined>(undefined);
  const categoryName = new Map((categories.data ?? []).map((c) => [c.id, c.name]));

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Item models"
        description="What can be rented — its price, how long, and the cleaning time between rentals."
        actions={writable && <Button onClick={() => setEditing('new')}>New item model</Button>}
      />
      {models.isPending && <Loading />}
      {models.isError && <ErrorNote error={models.error} onRetry={() => void models.refetch()} />}
      {models.isSuccess && models.data.length === 0 && (
        <EmptyState
          title="No item models yet"
          hint="Create a category first, then add the things you rent."
        />
      )}
      {models.isSuccess && models.data.length > 0 && (
        <Table aria-label="Item models">
          <THead>
            <Tr>
              <Th>Name</Th>
              <Th>Category</Th>
              <Th className="text-right">Price per slot</Th>
              <Th>Slot / length</Th>
              <Th className="text-right">Deposit</Th>
              <Th className="text-right">Units</Th>
              <Th>Status</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </Tr>
          </THead>
          <TBody>
            {models.data.map((m) => (
              <Tr key={m.id}>
                <Td className="font-medium">{m.name}</Td>
                <Td>{categoryName.get(m.categoryId) ?? '—'}</Td>
                <Td className="text-right tabular-nums">{formatPaise(m.pricePerSlotPaise)}</Td>
                <Td className="text-sm">
                  {m.slotMinutes} min slots
                  <div className="text-xs text-muted-foreground">
                    {formatDuration(m.minDurationMin)} – {formatDuration(m.maxDurationMin)}
                    {m.bufferMin > 0 ? `, ${m.bufferMin} min cleaning` : ''}
                  </div>
                </Td>
                <Td className="text-right tabular-nums">{formatPaise(m.depositPaise)}</Td>
                <Td className="text-right tabular-nums">{m.assetCount}</Td>
                <Td>
                  <Badge tone={m.status === 'active' ? 'success' : 'neutral'}>
                    {m.status === 'active' ? 'Active' : 'Inactive'}
                  </Badge>
                </Td>
                <Td className="text-right">
                  {writable && (
                    <Button variant="outline" size="sm" onClick={() => setEditing(m)}>
                      Edit
                    </Button>
                  )}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
      {editing && (
        <ItemModelForm
          model={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  );
}

const whole = (text: string): number | undefined =>
  /^\d{1,7}$/.test(text.trim()) ? Number(text.trim()) : undefined;

function ItemModelForm({ model, onClose }: { model: ItemModel | undefined; onClose: () => void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const categories = useCategories();
  const [name, setName] = useState(model?.name ?? '');
  const [description, setDescription] = useState(model?.description ?? '');
  const [categoryId, setCategoryId] = useState(model?.categoryId ?? '');
  const [price, setPrice] = useState(model ? paiseToRupees(model.pricePerSlotPaise) : '');
  const [slot, setSlot] = useState(String(model?.slotMinutes ?? 30));
  const [minimum, setMinimum] = useState(String(model?.minDurationMin ?? 30));
  const [maximum, setMaximum] = useState(String(model?.maxDurationMin ?? 240));
  const [buffer, setBuffer] = useState(String(model?.bufferMin ?? 0));
  const [deposit, setDeposit] = useState(model ? paiseToRupees(model.depositPaise) : '0');
  const [status, setStatus] = useState<string>(model?.status ?? 'active');
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  // Pictures chosen for a NEW product; they are uploaded right after it is saved.
  const [pending, setPending] = useState<File[]>([]);
  // Set when the product was created but some pictures failed: the form then carries on as an edit of it.
  const [created, setCreated] = useState<ItemModel | undefined>(undefined);
  const [uploadNote, setUploadNote] = useState<string | undefined>(undefined);
  const current = model ?? created;

  const save = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      current
        ? unwrap(
            await api.PATCH('/v1/admin/item-models/{id}', {
              params: { path: { id: current.id } },
              body: { ...body, status: status as 'active' | 'inactive' },
            }),
          )
        : unwrap(await api.POST('/v1/admin/item-models', { body: body as never })),
    onSuccess: async (saved) => {
      // A new product now exists: upload the pictures chosen for it (one failing does not stop the rest).
      if (!current && pending.length > 0) {
        const failed: string[] = [];
        for (const file of pending) {
          try {
            await uploadPhoto(api, saved.id, file);
          } catch {
            failed.push(file.name);
          }
        }
        await queryClient.invalidateQueries({ queryKey: ['item-models'] });
        if (failed.length > 0) {
          setCreated(saved);
          setPending([]);
          setUploadNote(
            `The product was saved, but these pictures could not be uploaded: ${failed.join(', ')}. Add them again below.`,
          );
          return;
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['item-models'] });
      onClose();
    },
  });
  const server = fieldErrors(save.error);
  const problems = { ...server, ...localErrors };

  function submit(event: FormEvent) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    const pricePaise = rupeesToPaise(price);
    const depositPaise = rupeesToPaise(deposit);
    const slotMinutes = whole(slot);
    const minDurationMin = whole(minimum);
    const maxDurationMin = whole(maximum);
    const bufferMin = whole(buffer);
    if (name.trim() === '') errors['name'] = 'Enter a name.';
    else if (name.trim().length > 120) errors['name'] = 'Use at most 120 characters.';
    if (description.trim().length > 2000) errors['description'] = 'Use at most 2000 characters.';
    if (categoryId === '') errors['categoryId'] = 'Choose a category.';
    if (pricePaise === undefined)
      errors['pricePerSlotPaise'] = 'Enter an amount such as 49 or 49.50.';
    if (depositPaise === undefined) errors['depositPaise'] = 'Enter an amount such as 0 or 200.';
    if (slotMinutes === undefined || slotMinutes < 1)
      errors['slotMinutes'] = 'Enter whole minutes.';
    if (minDurationMin === undefined) errors['minDurationMin'] = 'Enter whole minutes.';
    if (maxDurationMin === undefined) errors['maxDurationMin'] = 'Enter whole minutes.';
    if (bufferMin === undefined) errors['bufferMin'] = 'Enter whole minutes (0 for none).';
    // Rules between the numbers, in words a person can act on (the server checks them too).
    if (slotMinutes !== undefined && slotMinutes >= 1) {
      if (minDurationMin !== undefined && minDurationMin < slotMinutes)
        errors['minDurationMin'] = `At least one slot (${slotMinutes} minutes).`;
      else if (minDurationMin !== undefined && minDurationMin % slotMinutes !== 0)
        errors['minDurationMin'] = `Use a multiple of the slot length (${slotMinutes} minutes).`;
      if (maxDurationMin !== undefined && maxDurationMin % slotMinutes !== 0)
        errors['maxDurationMin'] = `Use a multiple of the slot length (${slotMinutes} minutes).`;
    }
    if (
      minDurationMin !== undefined &&
      maxDurationMin !== undefined &&
      maxDurationMin < minDurationMin &&
      errors['maxDurationMin'] === undefined
    )
      errors['maxDurationMin'] = 'Must not be shorter than the shortest rental.';
    setLocalErrors(errors);
    if (Object.keys(errors).length > 0) return;

    save.mutate({
      name: name.trim(),
      description: description.trim() === '' ? null : description.trim(),
      categoryId,
      pricePerSlotPaise: pricePaise,
      slotMinutes,
      minDurationMin,
      maxDurationMin,
      bufferMin,
      depositPaise,
    });
  }

  return (
    <Modal
      title={model ? `Edit ${model.name}` : 'New item model'}
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="model-form" disabled={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form id="model-form" className="grid gap-4 sm:grid-cols-2" onSubmit={submit} noValidate>
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={problems['name']}
          className="sm:col-span-2"
        />
        <Field label="Category" error={problems['categoryId']}>
          {(aria) => (
            <Select {...aria} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Choose…</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {model && (
          <Field
            label="Status"
            hint="Inactive models are hidden from customers."
            error={problems['status']}
          >
            {(aria) => (
              <Select {...aria} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            )}
          </Field>
        )}
        <TextField
          label="Price per slot (₹)"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          error={problems['pricePerSlotPaise']}
        />
        <TextField
          label="Deposit (₹)"
          inputMode="decimal"
          hint="Returned when the item comes back."
          value={deposit}
          onChange={(e) => setDeposit(e.target.value)}
          error={problems['depositPaise']}
        />
        <TextField
          label="Slot length (minutes)"
          inputMode="numeric"
          value={slot}
          onChange={(e) => setSlot(e.target.value)}
          error={problems['slotMinutes']}
        />
        <TextField
          label="Cleaning time between rentals (minutes)"
          inputMode="numeric"
          value={buffer}
          onChange={(e) => setBuffer(e.target.value)}
          error={problems['bufferMin']}
        />
        <TextField
          label="Shortest rental (minutes)"
          inputMode="numeric"
          hint="A multiple of the slot length."
          value={minimum}
          onChange={(e) => setMinimum(e.target.value)}
          error={problems['minDurationMin']}
        />
        <TextField
          label="Longest rental (minutes)"
          inputMode="numeric"
          hint="A multiple of the slot length."
          value={maximum}
          onChange={(e) => setMaximum(e.target.value)}
          error={problems['maxDurationMin']}
        />
        <Field label="Description" className="sm:col-span-2" error={problems['description']}>
          {(aria) => (
            <Textarea
              {...aria}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </Field>
        {current ? (
          <PhotoGallery model={current} />
        ) : (
          <PendingPhotos files={pending} onChange={setPending} />
        )}
        {uploadNote && (
          <p role="alert" className="text-sm text-destructive sm:col-span-2">
            {uploadNote}
          </p>
        )}
        <ErrorNote
          className="sm:col-span-2"
          error={save.error && Object.keys(server).length === 0 ? save.error : undefined}
        />
      </form>
    </Modal>
  );
}

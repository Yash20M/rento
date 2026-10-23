import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useApi } from '@/api/api-provider';
import { fieldErrors, unwrap } from '@/api/errors';
import type { Asset } from '@/api/types';
import { useAuth } from '@/auth/auth-context';
import { Pager } from '@/components/pager';
import { EmptyState, ErrorNote, Loading, PageHeader } from '@/components/page';
import { Badge, type Tone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Select, TextField } from '@/components/ui/controls';
import { Modal } from '@/components/ui/modal';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { humanize } from '@/lib/format';
import { useDrawers } from '../drawers/DrawersPage';
import { useItemModels } from './ItemModelsPage';
import { TransferDialog } from './TransferDialog';
import { usePaged } from '@/lib/use-paged';

const STATUS_TONE: Record<string, Tone> = {
  available: 'success',
  maintenance: 'warning',
  in_transfer: 'info',
  retired: 'neutral',
};
const STATUSES = ['available', 'maintenance', 'in_transfer', 'retired'] as const;
const EDITABLE = ['available', 'maintenance', 'retired'] as const;

export function AssetsPage() {
  const api = useApi();
  const { can } = useAuth();
  const writable = can('assets:write');
  const drawers = useDrawers();
  const models = useItemModels();
  const [drawerId, setDrawerId] = useState('');
  const [itemModelId, setItemModelId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [editing, setEditing] = useState<Asset | 'new' | undefined>(undefined);
  const [transferring, setTransferring] = useState<Asset | undefined>(undefined);

  const list = usePaged({
    name: 'assets',
    filters: [{ drawerId, itemModelId, status, applied }],
    fetchPage: async (cursor, limit) => {
      const page = unwrap(
        await api.GET('/v1/admin/assets', {
          params: {
            query: {
              limit,
              ...(drawerId !== '' && { drawerId }),
              ...(itemModelId !== '' && { itemModelId }),
              ...(status !== '' && { status: status as (typeof STATUSES)[number] }),
              ...(applied !== '' && { q: applied }),
              ...(cursor !== undefined && { cursor: cursor }),
            },
          },
        }),
      );
      return { items: page.data, nextCursor: page.nextCursor };
    },
  });
  const rows = list.rows;

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Assets"
        description="The physical units — each one is booked on its own."
        actions={writable && <Button onClick={() => setEditing('new')}>New asset</Button>}
      />
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(search.trim());
        }}
      >
        <div className="grid gap-1.5">
          <label htmlFor="asset-drawer" className="text-sm font-medium">
            Drawer
          </label>
          <Select id="asset-drawer" value={drawerId} onChange={(e) => setDrawerId(e.target.value)}>
            <option value="">All drawers</option>
            {(drawers.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="asset-model" className="text-sm font-medium">
            Item model
          </label>
          <Select
            id="asset-model"
            value={itemModelId}
            onChange={(e) => setItemModelId(e.target.value)}
          >
            <option value="">All models</option>
            {(models.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="asset-status" className="text-sm font-medium">
            Status
          </label>
          <Select id="asset-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </Select>
        </div>
        <TextField label="Code" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {list.isPending && <Loading />}
      {list.isError && <ErrorNote error={list.error} onRetry={() => void list.refetch()} />}
      {list.isSuccess && rows.length === 0 && <EmptyState title="No assets match" />}
      {rows.length > 0 && (
        <Table aria-label="Assets">
          <THead>
            <Tr>
              <Th>Code</Th>
              <Th>Item model</Th>
              <Th>Drawer</Th>
              <Th>Serial number</Th>
              <Th>Status</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((a) => (
              <Tr key={a.id}>
                <Td className="font-medium">{a.assetCode}</Td>
                <Td>{a.itemModelName}</Td>
                <Td>{a.drawerName}</Td>
                <Td className="text-muted-foreground">{a.serialNo ?? '—'}</Td>
                <Td>
                  <Badge tone={STATUS_TONE[a.status] ?? 'neutral'}>{humanize(a.status)}</Badge>
                </Td>
                <Td className="space-x-2 text-right">
                  {can('assets:transfer', a.drawerId) &&
                    (a.status === 'available' || a.status === 'in_transfer') && (
                      <Button variant="outline" size="sm" onClick={() => setTransferring(a)}>
                        {a.status === 'in_transfer' ? 'Transfer status' : 'Transfer…'}
                      </Button>
                    )}
                  {writable && (
                    <Button variant="outline" size="sm" onClick={() => setEditing(a)}>
                      Edit
                    </Button>
                  )}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
      <Pager pager={list} />
      {transferring && (
        <TransferDialog asset={transferring} onClose={() => setTransferring(undefined)} />
      )}
      {editing && (
        <AssetForm
          asset={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  );
}

function AssetForm({ asset, onClose }: { asset: Asset | undefined; onClose: () => void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const drawers = useDrawers();
  const models = useItemModels();
  const [code, setCode] = useState(asset?.assetCode ?? '');
  const [modelId, setModelId] = useState(asset?.itemModelId ?? '');
  const [drawerId, setDrawerId] = useState(asset?.drawerId ?? '');
  const [serial, setSerial] = useState(asset?.serialNo ?? '');
  const [status, setStatus] = useState<string>(asset?.status ?? 'available');
  const [local, setLocal] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: async () =>
      asset
        ? unwrap(
            await api.PATCH('/v1/admin/assets/{id}', {
              params: { path: { id: asset.id } },
              body: {
                serialNo: serial.trim() === '' ? null : serial.trim(),
                ...(status !== asset.status && { status: status as (typeof EDITABLE)[number] }),
              },
            }),
          )
        : unwrap(
            await api.POST('/v1/admin/assets', {
              body: {
                assetCode: code.trim(),
                itemModelId: modelId,
                drawerId,
                ...(serial.trim() !== '' && { serialNo: serial.trim() }),
              },
            }),
          ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['assets'] });
      await queryClient.invalidateQueries({ queryKey: ['item-models'] });
      onClose();
    },
  });
  const server = fieldErrors(save.error);
  const problems = { ...server, ...local };

  function submit(event: FormEvent) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!asset) {
      if (code.trim() === '') errors['assetCode'] = 'Enter a code such as PS5-001.';
      if (modelId === '') errors['itemModelId'] = 'Choose an item model.';
      if (drawerId === '') errors['drawerId'] = 'Choose a drawer.';
    }
    setLocal(errors);
    if (Object.keys(errors).length === 0) save.mutate();
  }

  return (
    <Modal
      title={asset ? `Edit ${asset.assetCode}` : 'New asset'}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="asset-form" disabled={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form id="asset-form" className="grid gap-4" onSubmit={submit} noValidate>
        {!asset && (
          <>
            <TextField
              label="Code"
              hint="Unique, printed on the unit. Letters, digits and dashes."
              value={code}
              onChange={(e) => setCode(e.target.value)}
              error={problems['assetCode']}
            />
            <Field label="Item model" error={problems['itemModelId']}>
              {(aria) => (
                <Select {...aria} value={modelId} onChange={(e) => setModelId(e.target.value)}>
                  <option value="">Choose…</option>
                  {(models.data ?? [])
                    .filter((m) => m.status === 'active')
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </Select>
              )}
            </Field>
            <Field label="Drawer" error={problems['drawerId']}>
              {(aria) => (
                <Select {...aria} value={drawerId} onChange={(e) => setDrawerId(e.target.value)}>
                  <option value="">Choose…</option>
                  {(drawers.data ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </>
        )}
        <TextField
          label="Serial number (optional)"
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
          error={problems['serialNo']}
        />
        {asset && (
          <Field
            label="Status"
            hint="A unit in maintenance or retired is not offered to customers. Retiring is final."
            error={problems['status']}
          >
            {(aria) => (
              <Select {...aria} value={status} onChange={(e) => setStatus(e.target.value)}>
                {(asset.status === 'in_transfer' ? ['in_transfer', ...EDITABLE] : EDITABLE).map(
                  (s) => (
                    <option key={s} value={s} disabled={s === 'in_transfer'}>
                      {humanize(s)}
                    </option>
                  ),
                )}
              </Select>
            )}
          </Field>
        )}
        <ErrorNote
          error={save.error && Object.keys(server).length === 0 ? save.error : undefined}
        />
      </form>
    </Modal>
  );
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useApi } from '@/api/api-provider';
import { fieldErrors, unwrap } from '@/api/errors';
import type { Drawer } from '@/api/types';
import { useAuth } from '@/auth/auth-context';
import { EmptyState, ErrorNote, Loading, PageHeader } from '@/components/page';
import { Badge, type Tone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Select, Textarea, TextField } from '@/components/ui/controls';
import { CoverThumb } from '@/components/ui/avatar';
import { Modal } from '@/components/ui/modal';
import { summariseHours } from '@/lib/hours';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { humanize } from '@/lib/format';
import { ClosuresModal } from './ClosuresModal';
import { DrawerPhoto } from './DrawerPhoto';
import {
  DEFAULT_HOURS,
  HoursEditor,
  type HoursRows,
  hoursFromRows,
  hoursToRows,
} from './HoursEditor';

export function useDrawers() {
  const api = useApi();
  const { can } = useAuth();
  return useQuery({
    queryKey: ['drawers'],
    enabled: can('drawers:read'),
    queryFn: async () => unwrap(await api.GET('/v1/admin/drawers')),
  });
}

const TONE: Record<string, Tone> = {
  active: 'success',
  temporarily_closed: 'warning',
  inactive: 'neutral',
};
const STATUSES = ['active', 'temporarily_closed', 'inactive'] as const;
const ZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
  'UTC',
];
export function DrawersPage() {
  const { can } = useAuth();
  const writable = can('drawers:write');
  const drawers = useDrawers();
  const [editing, setEditing] = useState<Drawer | 'new' | undefined>(undefined);
  const [hoursFor, setHoursFor] = useState<Drawer | undefined>(undefined);
  const [closuresFor, setClosuresFor] = useState<Drawer | undefined>(undefined);

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Drawers"
        description="The places where customers collect and return items."
        actions={writable && <Button onClick={() => setEditing('new')}>New drawer</Button>}
      />
      {drawers.isPending && <Loading />}
      {drawers.isError && (
        <ErrorNote error={drawers.error} onRetry={() => void drawers.refetch()} />
      )}
      {drawers.isSuccess && drawers.data.length === 0 && (
        <EmptyState
          title="No drawers yet"
          hint="Add the first place customers can collect items from."
        />
      )}
      {drawers.isSuccess && drawers.data.length > 0 && (
        <Table aria-label="Drawers">
          <THead>
            <Tr>
              <Th>Name</Th>
              <Th>Address</Th>
              <Th>Opening hours</Th>
              <Th className="text-right">Units</Th>
              <Th>Status</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </Tr>
          </THead>
          <TBody>
            {drawers.data.map((d) => (
              <Tr key={d.id}>
                <Td className="font-medium">
                  <div className="flex items-center gap-3">
                    <CoverThumb name={d.name} src={d.photoUrl} />
                    <div className="min-w-0">
                      {d.name}
                      <div className="text-xs text-muted-foreground">{d.timezone}</div>
                    </div>
                  </div>
                </Td>
                <Td>{d.address}</Td>
                <Td className="max-w-xs text-xs text-muted-foreground">
                  {summariseHours(d.hours)}
                </Td>
                <Td className="text-right tabular-nums">{d.assetCount}</Td>
                <Td>
                  <Badge tone={TONE[d.status] ?? 'neutral'}>{humanize(d.status)}</Badge>
                </Td>
                <Td>
                  <div className="flex flex-wrap justify-end gap-2">
                    {writable && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setEditing(d)}>
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setHoursFor(d)}>
                          Hours
                        </Button>
                      </>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setClosuresFor(d)}>
                      Closures
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
      {editing && (
        <DrawerForm
          drawer={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
        />
      )}
      {hoursFor && <HoursModal drawer={hoursFor} onClose={() => setHoursFor(undefined)} />}
      {closuresFor && (
        <ClosuresModal
          drawer={closuresFor}
          writable={writable}
          onClose={() => setClosuresFor(undefined)}
        />
      )}
    </div>
  );
}

const coordinate = (text: string): number | undefined => {
  const value = Number(text.trim());
  return text.trim() !== '' && Number.isFinite(value) ? value : undefined;
};

function DrawerForm({ drawer, onClose }: { drawer: Drawer | undefined; onClose: () => void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [name, setName] = useState(drawer?.name ?? '');
  const [address, setAddress] = useState(drawer?.address ?? '');
  const [timezone, setTimezone] = useState(drawer?.timezone ?? 'Asia/Kolkata');
  const [latitude, setLatitude] = useState(drawer ? String(drawer.latitude) : '');
  const [longitude, setLongitude] = useState(drawer ? String(drawer.longitude) : '');
  const [status, setStatus] = useState<string>(drawer?.status ?? 'active');
  const [instructions, setInstructions] = useState(drawer?.pickupInstructions ?? '');
  const [hours, setHours] = useState<HoursRows>(() =>
    drawer ? hoursToRows(drawer.hours) : DEFAULT_HOURS,
  );
  const [local, setLocal] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: async (place: { latitude: number; longitude: number }) => {
      const common = {
        name: name.trim(),
        address: address.trim(),
        timezone: timezone.trim(),
        pickupInstructions: instructions.trim() === '' ? null : instructions.trim(),
        ...place,
      };
      return drawer
        ? unwrap(
            await api.PATCH('/v1/admin/drawers/{id}', {
              params: { path: { id: drawer.id } },
              body: { ...common, status: status as (typeof STATUSES)[number] },
            }),
          )
        : unwrap(
            await api.POST('/v1/admin/drawers', {
              body: { ...common, hours: hoursFromRows(hours) },
            }),
          );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['drawers'] });
      onClose();
    },
  });
  const server = fieldErrors(save.error);
  const problems = { ...server, ...local };

  function submit(event: FormEvent) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    const lat = coordinate(latitude);
    const lng = coordinate(longitude);
    if (name.trim() === '') errors['name'] = 'Enter a name.';
    if (address.trim() === '') errors['address'] = 'Enter the address.';
    if (timezone.trim() === '') errors['timezone'] = 'Enter a time zone such as Asia/Kolkata.';
    if (lat === undefined || lat < -90 || lat > 90)
      errors['latitude'] = 'Latitude is a number from −90 to 90.';
    if (lng === undefined || lng < -180 || lng > 180)
      errors['longitude'] = 'Longitude is a number from −180 to 180.';
    setLocal(errors);
    if (Object.keys(errors).length === 0 && lat !== undefined && lng !== undefined) {
      save.mutate({ latitude: lat, longitude: lng });
    }
  }

  return (
    <Modal
      title={drawer ? `Edit ${drawer.name}` : 'New drawer'}
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="drawer-form" disabled={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form id="drawer-form" className="grid gap-4 sm:grid-cols-2" onSubmit={submit} noValidate>
        {drawer && <DrawerPhoto drawer={drawer} />}
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={problems['name']}
        />
        {drawer ? (
          <Field
            label="Status"
            hint="Closed or inactive drawers are not offered to customers."
            error={problems['status']}
          >
            {(aria) => (
              <Select {...aria} value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {humanize(s)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : (
          <div />
        )}
        <TextField
          label="Address"
          className="sm:col-span-2"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          error={problems['address']}
        />
        <Field
          label="Time zone"
          hint="Opening hours are in this zone."
          error={problems['timezone']}
        >
          {(aria) => (
            <>
              <input
                {...aria}
                list="zones"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              />
              <datalist id="zones">
                {ZONES.map((z) => (
                  <option key={z} value={z} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Latitude"
            inputMode="decimal"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            error={problems['latitude']}
          />
          <TextField
            label="Longitude"
            inputMode="decimal"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            error={problems['longitude']}
          />
        </div>
        <Field
          label="Pickup instructions"
          className="sm:col-span-2"
          error={problems['pickupInstructions']}
        >
          {(aria) => (
            <Textarea
              {...aria}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              maxLength={1000}
            />
          )}
        </Field>
        {!drawer && (
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium">Opening hours</p>
            <HoursEditor rows={hours} onChange={setHours} />
            {problems['hours'] && (
              <p role="alert" className="mt-1 text-xs text-destructive">
                {problems['hours']}
              </p>
            )}
          </div>
        )}
        <ErrorNote
          className="sm:col-span-2"
          error={save.error && Object.keys(server).length === 0 ? save.error : undefined}
        />
      </form>
    </Modal>
  );
}

function HoursModal({ drawer, onClose }: { drawer: Drawer; onClose: () => void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<HoursRows>(() => hoursToRows(drawer.hours));
  const save = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.PUT('/v1/admin/drawers/{id}/hours', {
          params: { path: { id: drawer.id } },
          body: { hours: hoursFromRows(rows) },
        }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['drawers'] });
      onClose();
    },
  });
  const problems = fieldErrors(save.error);
  return (
    <Modal
      title={`Opening hours — ${drawer.name}`}
      description={`Times are local to the drawer (${drawer.timezone}). A day without hours is closed.`}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Save hours
          </Button>
        </>
      }
    >
      <HoursEditor rows={rows} onChange={setRows} errors={problems} />
      <ErrorNote
        className="mt-3"
        error={save.error && Object.keys(problems).length === 0 ? save.error : undefined}
      />
    </Modal>
  );
}

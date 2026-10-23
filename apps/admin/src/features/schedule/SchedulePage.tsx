import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useApi } from '@/api/api-provider';
import { unwrap } from '@/api/errors';
import type { ScheduleAsset, ScheduleEntry } from '@/api/types';
import { useAuth } from '@/auth/auth-context';
import { EmptyState, ErrorNote, Loading, PageHeader } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Select, TextField } from '@/components/ui/controls';
import { Modal } from '@/components/ui/modal';
import { BookingDetailModal } from '@/features/bookings/BookingDetailModal';
import { cn } from '@/lib/utils';
import { zonedLocalToIso } from '@/lib/format';
import { BlockDialog } from './BlockDialog';

const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` of the given instant in a time zone. */
export function dayIn(timeZone: string, at = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(at);
}

const nextDay = (day: string): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);

/** The 24 hours of a calendar day in a time zone, as UTC instants. `undefined` while the input is incomplete. */
export function dayWindow(day: string, timeZone: string): { from: string; to: string } | undefined {
  const from = zonedLocalToIso(`${day}T00:00`, timeZone);
  const to = zonedLocalToIso(`${nextDay(day)}T00:00`, timeZone);
  return from && to ? { from, to } : undefined;
}

export const clockTime = (iso: string, timeZone: string): string =>
  new Intl.DateTimeFormat('en-IN', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));

const KIND_LABEL: Record<string, string> = {
  booking: 'Booking',
  maintenance: 'Maintenance',
  admin_block: 'Blocked',
  transfer: 'Transfer',
};

/** What is happening to every unit of a drawer during one day (README §13.3). Times are the drawer's own. */
export function SchedulePage() {
  const api = useApi();
  const { can } = useAuth();
  const [drawerId, setDrawerId] = useState('');
  const [day, setDay] = useState('');
  const [bookingId, setBookingId] = useState<string | undefined>(undefined);
  const [blockFor, setBlockFor] = useState<ScheduleAsset | undefined>(undefined);
  const [openBlock, setOpenBlock] = useState<
    { asset: ScheduleAsset; entry: ScheduleEntry } | undefined
  >(undefined);

  const drawers = useQuery({
    queryKey: ['drawers'],
    queryFn: async () => unwrap(await api.GET('/v1/admin/drawers')),
  });
  const selected = drawers.data?.find((d) => d.id === drawerId) ?? drawers.data?.[0];
  const timeZone = selected?.timezone ?? 'UTC';
  const shownDay = day || dayIn(timeZone);
  const window = dayWindow(shownDay, timeZone);

  const schedule = useQuery({
    queryKey: ['schedule', selected?.id, window?.from, window?.to],
    enabled: selected !== undefined && window !== undefined,
    queryFn: async () =>
      unwrap(
        await api.GET('/v1/admin/drawers/{id}/schedule', {
          params: {
            path: { id: selected!.id },
            query: { startsAt: window!.from, endsAt: window!.to },
          },
        }),
      ),
  });

  const hours = Array.from({ length: 25 }, (_, i) => i);

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Schedule"
        description="What is happening to every unit of a drawer today: bookings (with their cleaning time) and maintenance blocks."
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <label htmlFor="schedule-drawer" className="text-sm font-medium">
            Drawer
          </label>
          <Select
            id="schedule-drawer"
            value={selected?.id ?? ''}
            onChange={(e) => setDrawerId(e.target.value)}
          >
            {drawers.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
        <TextField
          label="Day"
          type="date"
          value={shownDay}
          onChange={(e) => setDay(e.target.value)}
          hint={`In ${timeZone}`}
        />
        <Button variant="outline" onClick={() => setDay(dayIn(timeZone))}>
          Today
        </Button>
      </div>

      {(drawers.isPending || (schedule.isPending && selected)) && <Loading />}
      {drawers.isError && (
        <ErrorNote error={drawers.error} onRetry={() => void drawers.refetch()} />
      )}
      {schedule.isError && (
        <ErrorNote error={schedule.error} onRetry={() => void schedule.refetch()} />
      )}
      {drawers.isSuccess && drawers.data.length === 0 && <EmptyState title="No drawers yet" />}
      {schedule.data && schedule.data.assets.length === 0 && (
        <EmptyState title="This drawer has no units" />
      )}

      {schedule.data && window && schedule.data.assets.length > 0 && (
        <div className="overflow-x-auto rounded-lg border" aria-label="Schedule">
          <div className="min-w-[56rem]">
            <div className="grid grid-cols-[11rem_1fr] border-b bg-muted/50 text-xs text-muted-foreground">
              <div className="px-3 py-2">Unit</div>
              <div className="relative h-8">
                {hours.map((h) => (
                  <span
                    key={h}
                    className="absolute top-2 -translate-x-1/2"
                    style={{ left: `${(h / 24) * 100}%` }}
                  >
                    {h % 2 === 0 && h < 24 ? String(h).padStart(2, '0') : ''}
                  </span>
                ))}
              </div>
            </div>
            {schedule.data.assets.map((asset) => (
              <div
                key={asset.assetId}
                className="grid grid-cols-[11rem_1fr] border-b last:border-b-0"
                role="group"
                aria-label={`Unit ${asset.assetCode}`}
              >
                <div className="px-3 py-2 text-sm">
                  <div className="font-medium">{asset.assetCode}</div>
                  <div className="text-xs text-muted-foreground">{asset.itemModel}</div>
                  {asset.status !== 'available' && (
                    <div className="text-xs text-destructive">Unit is {asset.status}</div>
                  )}
                  {can('assets:write', schedule.data.drawerId) && (
                    <button
                      type="button"
                      className="mt-1 text-xs text-primary underline-offset-2 hover:underline"
                      onClick={() => setBlockFor(asset)}
                    >
                      Block time…
                    </button>
                  )}
                </div>
                <div className="relative h-14">
                  {hours.slice(1, 24).map((h) => (
                    <span
                      key={h}
                      aria-hidden="true"
                      className="absolute inset-y-0 border-l border-border/60"
                      style={{ left: `${(h / 24) * 100}%` }}
                    />
                  ))}
                  {asset.entries.map((entry, index) => (
                    <Bar
                      key={`${entry.blockedFrom}-${index}`}
                      entry={entry}
                      window={window}
                      timeZone={timeZone}
                      onOpen={() =>
                        entry.bookingId
                          ? setBookingId(entry.bookingId)
                          : setOpenBlock({ asset, entry })
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {bookingId && <BookingDetailModal id={bookingId} onClose={() => setBookingId(undefined)} />}
      {blockFor && selected && (
        <BlockDialog
          asset={blockFor}
          timeZone={timeZone}
          day={shownDay}
          onClose={() => setBlockFor(undefined)}
        />
      )}
      {openBlock && (
        <BlockDetail
          assetId={openBlock.asset.assetId}
          assetCode={openBlock.asset.assetCode}
          entry={openBlock.entry}
          timeZone={timeZone}
          drawerId={schedule.data?.drawerId}
          onClose={() => setOpenBlock(undefined)}
        />
      )}
    </div>
  );
}

function Bar({
  entry,
  window,
  timeZone,
  onOpen,
}: {
  entry: ScheduleEntry;
  window: { from: string; to: string };
  timeZone: string;
  onOpen: () => void;
}) {
  const start = Date.parse(window.from);
  const span = Date.parse(window.to) - start;
  const pct = (iso: string) => Math.min(100, Math.max(0, ((Date.parse(iso) - start) / span) * 100));
  const left = pct(entry.blockedFrom);
  const width = Math.max(0.8, pct(entry.blockedUntil) - left);
  const isBooking = entry.kind === 'booking';
  const label = isBooking
    ? `Booking of ${entry.customer ?? 'a customer'}, ${clockTime(entry.startsAt ?? entry.blockedFrom, timeZone)} to ${clockTime(entry.endsAt ?? entry.blockedUntil, timeZone)}`
    : `${KIND_LABEL[entry.kind] ?? entry.kind}, ${clockTime(entry.blockedFrom, timeZone)} to ${clockTime(entry.blockedUntil, timeZone)}${entry.reason ? `: ${entry.reason}` : ''}`;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onOpen}
      className={cn(
        'absolute top-2 flex h-10 items-center overflow-hidden rounded-md px-1.5 text-left text-xs font-medium',
        isBooking ? 'bg-primary/80 text-primary-foreground' : 'bg-amber-500/80 text-amber-950',
        entry.bookingStatus === 'held' && 'opacity-60',
      )}
      style={{ left: `${left}%`, width: `${width}%` }}
    >
      <span className="truncate">
        {isBooking ? (entry.customer ?? 'Booking') : (KIND_LABEL[entry.kind] ?? entry.kind)}
      </span>
    </button>
  );
}

function BlockDetail({
  assetId,
  assetCode,
  entry,
  timeZone,
  drawerId,
  onClose,
}: {
  assetId: string;
  assetCode: string;
  entry: ScheduleEntry;
  timeZone: string;
  drawerId: string | undefined;
  onClose: () => void;
}) {
  const api = useApi();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const lift = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.DELETE('/v1/admin/assets/{id}/blocks/{blockId}', {
          params: { path: { id: assetId, blockId: entry.blockId ?? '' } },
        }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['schedule'] });
      onClose();
    },
  });
  return (
    <Modal
      title={`${KIND_LABEL[entry.kind] ?? entry.kind} · ${assetCode}`}
      description={`${clockTime(entry.blockedFrom, timeZone)} – ${clockTime(entry.blockedUntil, timeZone)} (${timeZone})`}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={lift.isPending}>
            Close
          </Button>
          {entry.blockId && can('assets:write', drawerId) && (
            <Button variant="destructive" onClick={() => lift.mutate()} disabled={lift.isPending}>
              Lift block
            </Button>
          )}
        </>
      }
    >
      <p className="text-sm">{entry.reason ?? 'No reason recorded.'}</p>
      <ErrorNote error={lift.error} className="mt-3" />
    </Modal>
  );
}

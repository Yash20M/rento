import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { InventoryRepository, type ItemModelRow } from '../../inventory';
import { DrawerRepository, type DrawerRow } from '../data/drawer.repository';
import { drawerNotFound, invalidDrawerField } from '../domain/drawer-rules';
import { isCalendarDate, isoWeekday, localParts, zonedToUtc } from '../domain/time';

const MINUTE_MS = 60_000;
const MAX_DAYS_AHEAD = 90;

export interface InventoryEntry {
  model: ItemModelRow;
  total: number;
  availableNow: number;
}

export interface Slot {
  startsAt: Date;
  /** Units of the model that could be rented from this start for at least the minimum duration. */
  freeAssets: number;
  /** The longest rental (a multiple of the slot length, capped by the model's maximum) that some unit can do. */
  maxFreeMinutes: number;
}

export interface Availability {
  drawer: DrawerRow;
  model: ItemModelRow;
  date: string;
  opensAt: Date | null;
  closesAt: Date | null;
  slots: Slot[];
  generatedAt: Date;
}

/**
 * What can be rented where and when (README §9.7, §14.3).
 *
 * **Everything here is a SNAPSHOT.** Another customer can take the last unit a millisecond after this answer was
 * computed; the booking request re-checks atomically in the database and may still answer 409.
 */
@Injectable()
export class AvailabilityService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly drawers: DrawerRepository,
    private readonly inventory: InventoryRepository,
  ) {}

  async drawerInventory(
    drawerId: string,
  ): Promise<{ drawer: DrawerRow; entries: InventoryEntry[] }> {
    const drawer = await this.visibleDrawer(drawerId);
    const rows = await this.drawers.inventory(this.db, drawerId, this.clock.now());
    const entries: InventoryEntry[] = [];
    for (const row of rows) {
      const model = await this.inventory.findItemModel(this.db, row.item_model_id);
      if (model) entries.push({ model, total: row.total, availableNow: row.available_now });
    }
    entries.sort((a, b) => a.model.name.localeCompare(b.model.name));
    return { drawer, entries };
  }

  async availability(drawerId: string, modelId: string, date: string): Promise<Availability> {
    if (!isCalendarDate(date))
      throw invalidDrawerField('date', 'use a calendar date such as 2030-01-31');

    const drawer = await this.visibleDrawer(drawerId);
    const model = await this.inventory.findItemModel(this.db, modelId);
    const assetIds = await this.drawers.rentableAssets(this.db, drawerId, modelId);
    const offered = (await this.drawers.inventory(this.db, drawerId, this.clock.now())).some(
      (row) => row.item_model_id === modelId,
    );
    if (!model || model.status !== 'active' || !offered) throw drawerNotFound();

    const now = this.clock.now();
    const today = localParts(now, drawer.timezone).date;
    const last = new Date(Date.parse(`${today}T00:00:00Z`) + MAX_DAYS_AHEAD * 86_400_000)
      .toISOString()
      .slice(0, 10);
    if (date < today || date > last) {
      throw invalidDrawerField('date', `choose a day from today to ${MAX_DAYS_AHEAD} days ahead`);
    }

    const base = { drawer, model, date, generatedAt: now };
    const hours = (await this.drawers.hoursFor(this.db, [drawerId])).find(
      (h) => h.weekday === isoWeekday(date),
    );
    if (!hours || drawer.status !== 'active') {
      return { ...base, opensAt: null, closesAt: null, slots: [] };
    }
    const opensAt = zonedToUtc(date, hours.opens_at, drawer.timezone);
    const closesAt = zonedToUtc(date, hours.closes_at, drawer.timezone);

    const slotMs = model.slot_minutes * MINUTE_MS;
    const minMs = model.min_duration_min * MINUTE_MS;
    const maxMs = model.max_duration_min * MINUTE_MS;
    const bufferMs = model.buffer_min * MINUTE_MS;

    const [occupancies, closures] = await Promise.all([
      this.drawers.occupancies(
        this.db,
        assetIds,
        opensAt,
        new Date(closesAt.getTime() + bufferMs + MINUTE_MS),
        now,
      ),
      this.drawers.closuresFor(this.db, [drawerId], opensAt),
    ]);
    const busyByAsset = new Map<string, Array<{ start: number; end: number }>>();
    for (const o of occupancies) {
      const list = busyByAsset.get(o.asset_id) ?? [];
      list.push({ start: o.starts_at.getTime(), end: o.ends_at.getTime() });
      busyByAsset.set(o.asset_id, list);
    }
    const closed = closures.map((c) => ({
      start: c.starts_at.getTime(),
      end: c.ends_at.getTime(),
    }));

    const slots: Slot[] = [];
    for (let start = opensAt.getTime(); start + minMs <= closesAt.getTime(); start += slotMs) {
      if (start < now.getTime()) continue; // the past cannot be booked
      // The rental itself must stay inside opening hours and clear of closures.
      let limit = closesAt.getTime();
      if (closed.some((c) => c.start <= start && start < c.end)) continue;
      for (const c of closed) if (c.start > start) limit = Math.min(limit, c.start);

      let free = 0;
      let longest = 0;
      for (const assetId of assetIds) {
        const busy = busyByAsset.get(assetId) ?? [];
        // Occupancies are stored as [start, end + buffer): the new rental needs its own buffer behind it as well.
        if (busy.some((b) => b.start < start + minMs + bufferMs && start < b.end)) continue;
        const next = busy.find((b) => b.start >= start);
        const hardEnd = Math.min(limit, next ? next.start - bufferMs : Number.POSITIVE_INFINITY);
        const usable = Math.min(Math.floor((hardEnd - start) / slotMs) * slotMs, maxMs);
        if (usable >= minMs) {
          free += 1;
          longest = Math.max(longest, usable);
        }
      }
      slots.push({
        startsAt: new Date(start),
        freeAssets: free,
        maxFreeMinutes: Math.floor(longest / MINUTE_MS),
      });
    }
    return { ...base, opensAt, closesAt, slots };
  }

  /** Customers only ever see active drawers. */
  private async visibleDrawer(id: string): Promise<DrawerRow> {
    const drawer = await this.drawers.find(this.db, id);
    if (!drawer || drawer.status === 'inactive') throw drawerNotFound();
    return drawer;
  }
}

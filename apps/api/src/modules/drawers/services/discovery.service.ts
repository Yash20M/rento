import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { DiscoverySettings } from './discovery-settings';
import { DrawerRepository, type HoursRow, type NearbyRow } from '../data/drawer.repository';
import { isOpenAt, outsideServiceArea } from '../domain/drawer-rules';

export type Unavailable = 'closed' | 'out_of_stock';

export interface NearbyCandidate {
  drawer: NearbyRow;
  hours: HoursRow[];
  openNow: boolean;
  /** Free units of the requested model right now (only when a model was given). */
  availableNow: number | null;
  reason: Unavailable | null;
}

export interface NearbyResult {
  drawers: NearbyCandidate[];
  unavailable: NearbyCandidate[];
}

/**
 * "Which drawer should I go to?" (README §10). Policy for the demo (README §10.3 defaults, owner decision Q-8 pending):
 * active drawers within the discovery radius setting, nearest first, only those that are OPEN NOW (hours and closures)
 * and — when an item model is given — have a free unit of it, up to the maximum-results setting. Drawers that are close but
 * closed or out of stock are returned separately with the reason, so the app can explain rather than go silent.
 * The customer's coordinates are used for this one query and are never stored or logged.
 */
@Injectable()
export class DiscoveryService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly drawers: DrawerRepository,
    private readonly settings: DiscoverySettings,
  ) {}

  async nearby(input: {
    latitude: number;
    longitude: number;
    itemModelId?: string | undefined;
  }): Promise<NearbyResult> {
    const now = this.clock.now();
    const policy = await this.settings.current();
    // Look at a few more than we return, so closed or empty drawers can be skipped.
    const candidates = await this.drawers.nearby(
      this.db,
      input,
      policy.radiusMeters,
      policy.maxResults * 4,
    );
    if (candidates.length === 0) throw outsideServiceArea();

    const ids = candidates.map((c) => c.id);
    const [hours, closures, stock] = await Promise.all([
      this.drawers.hoursFor(this.db, ids),
      this.drawers.closuresFor(this.db, ids, now),
      input.itemModelId
        ? this.drawers.freeUnitsNow(this.db, ids, input.itemModelId, now)
        : Promise.resolve(null),
    ]);

    const annotated: NearbyCandidate[] = candidates.map((drawer) => {
      const drawerHours = hours.filter((h) => h.drawer_id === drawer.id);
      const openNow = isOpenAt(
        now,
        drawer.timezone,
        drawerHours,
        closures.filter((c) => c.drawer_id === drawer.id),
      );
      const availableNow = stock ? (stock.get(drawer.id) ?? 0) : null;
      const reason: Unavailable | null = !openNow
        ? 'closed'
        : availableNow === 0
          ? 'out_of_stock'
          : null;
      return { drawer, hours: drawerHours, openNow, availableNow, reason };
    });

    return {
      drawers: annotated.filter((c) => c.reason === null).slice(0, policy.maxResults),
      unavailable: annotated.filter((c) => c.reason !== null).slice(0, policy.maxResults),
    };
  }
}

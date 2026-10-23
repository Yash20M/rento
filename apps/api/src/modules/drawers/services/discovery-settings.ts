import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/config.module';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { withTransaction } from '../../../db/transaction';
import { type Actor, AuditLog } from '../../reporting-audit';

export interface DiscoveryPolicy {
  radiusMeters: number;
  maxResults: number;
}

export const DISCOVERY_BOUNDS = {
  radiusMeters: { min: 100, max: 50_000 },
  maxResults: { min: 1, max: 10 },
} as const;

const KEY = 'discovery';
/** Another instance's edit shows up here within this long; this instance sees its own edit at once. */
const CACHE_MS = 30_000;

/**
 * "Which drawers are offered to a customer" rules the operator may change (README §10.3). The environment supplies the
 * starting values; a saved row overrides them. Reads are cached briefly and the cache is dropped on every save.
 */
@Injectable()
export class DiscoverySettings {
  private cached: { policy: DiscoveryPolicy; until: number } | undefined;

  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly audit: AuditLog,
  ) {}

  async current(): Promise<DiscoveryPolicy> {
    const now = this.clock.now().getTime();
    if (this.cached && this.cached.until > now) return this.cached.policy;
    const row = await this.db
      .selectFrom('app_settings')
      .select('value')
      .where('key', '=', KEY)
      .executeTakeFirst();
    const saved = (row?.value ?? {}) as Partial<DiscoveryPolicy>;
    const policy: DiscoveryPolicy = {
      radiusMeters: saved.radiusMeters ?? this.config.discoveryRadiusMeters,
      maxResults: saved.maxResults ?? this.config.discoveryMaxResults,
    };
    this.cached = { policy, until: now + CACHE_MS };
    return policy;
  }

  async update(actor: Actor, next: DiscoveryPolicy): Promise<DiscoveryPolicy> {
    const before = await this.current();
    await withTransaction(this.db, async (trx) => {
      await trx
        .insertInto('app_settings')
        .values({ key: KEY, value: JSON.stringify(next), updated_by: actor.id as string })
        .onConflict((oc) =>
          oc.column('key').doUpdateSet({
            value: JSON.stringify(next),
            updated_by: actor.id as string,
            updated_at: this.clock.now(),
          }),
        )
        .execute();
      await this.audit.record(trx, {
        actor,
        action: 'settings.discovery_updated',
        entityType: 'setting',
        before: { ...before },
        after: { ...next },
      });
    });
    this.cached = undefined;
    return next;
  }
}

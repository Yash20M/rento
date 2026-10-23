import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/config.module';
import type { EffectivePermissions, PermissionResolver } from '../domain/authorization';
import { DbPermissionResolver } from './db-permission-resolver';

interface Entry {
  value: EffectivePermissions;
  expiresAt: number;
}

/**
 * The authorization engine's entry point (README §13.5): effective permissions with a short in-memory cache that is
 * invalidated on every role / assignment change, so a revoked permission takes effect at once on this instance and
 * within `PERMISSION_CACHE_TTL_SECONDS` on any other. Permissions are never baked into the JWT.
 *
 * A generation counter makes invalidation race-free: a load that began before an invalidation is returned to its
 * caller but never stored, so a stale answer cannot outlive the change that made it stale.
 */
@Injectable()
export class PermissionAuthority implements PermissionResolver {
  private readonly cache = new Map<string, Entry>();
  private generation = 0;

  constructor(
    private readonly database: DbPermissionResolver,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: Pick<AppConfig, 'permissionCacheTtlSeconds'>,
  ) {}

  async effective(userId: string): Promise<EffectivePermissions> {
    const ttlMs = this.config.permissionCacheTtlSeconds * 1000;
    const now = this.clock.now().getTime();
    if (ttlMs > 0) {
      const hit = this.cache.get(userId);
      if (hit && hit.expiresAt > now) return hit.value;
    }

    const startedAt = this.generation;
    const value = await this.database.effective(userId);
    if (ttlMs > 0 && startedAt === this.generation) {
      this.cache.set(userId, { value, expiresAt: this.clock.now().getTime() + ttlMs });
    }
    return value;
  }

  /** One person's access changed (role set, deactivated, suspended). */
  invalidateUser(userId: string): void {
    this.generation += 1;
    this.cache.delete(userId);
  }

  /** A role changed: everybody holding it is affected, and finding them is not worth it. */
  invalidateAll(): void {
    this.generation += 1;
    this.cache.clear();
  }
}

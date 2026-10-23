import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import { AppError } from '../../../common/errors/app-error';
import { UniqueViolationError, pgErrorCode } from '../../../db/errors';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { withTransaction } from '../../../db/transaction';
import { type DrawerAccess, accessIncludes } from '../../access-control';
import { type Actor, AuditLog } from '../../reporting-audit';
import {
  type ClosureRow,
  DrawerRepository,
  type DrawerRow,
  type HoursRow,
} from '../data/drawer.repository';
import {
  closureNotFound,
  drawerNotFound,
  invalidDrawerField,
  permissionDenied,
  validateHours,
} from '../domain/drawer-rules';
import { isValidTimeZone } from '../domain/time';

export interface DrawerDetails {
  drawer: DrawerRow;
  hours: HoursRow[];
  assetCount: number;
}

export interface HoursInput {
  weekday: number;
  opensAt: string;
  closesAt: string;
}

const snapshot = (d: DrawerRow) => ({
  name: d.name,
  address: d.address,
  timezone: d.timezone,
  status: d.status,
  latitude: d.latitude,
  longitude: d.longitude,
  pickupInstructions: d.pickup_instructions,
});

const EXCLUDE_VIOLATION = '23P01';

/** Drawer administration. Administrators limited to some drawers only see and change those (README §13.5). */
@Injectable()
export class DrawerService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly drawers: DrawerRepository,
    private readonly audit: AuditLog,
  ) {}

  async list(access: DrawerAccess): Promise<DrawerDetails[]> {
    if (access.kind === 'none') return [];
    const rows = await this.drawers.list(this.db, access.kind === 'all' ? 'all' : access.ids);
    return this.withDetails(rows);
  }

  async get(access: DrawerAccess, id: string): Promise<DrawerDetails> {
    const row = await this.drawers.find(this.db, id);
    // A drawer outside the caller's scope is indistinguishable from one that does not exist.
    if (!row || !accessIncludes(access, id)) throw drawerNotFound();
    return (await this.withDetails([row]))[0] as DrawerDetails;
  }

  async create(
    actor: Actor,
    access: DrawerAccess,
    input: {
      name: string;
      address: string;
      timezone: string;
      latitude: number;
      longitude: number;
      pickupInstructions?: string | null | undefined;
      hours?: HoursInput[] | undefined;
    },
  ): Promise<DrawerDetails> {
    // Creating a drawer is not "inside" any one drawer: only an unrestricted grant may do it.
    if (access.kind !== 'all') throw permissionDenied();
    this.checkTimeZone(input.timezone);
    this.checkHours(input.hours ?? []);
    const id = await withTransaction(this.db, async (trx) => {
      const newId = await this.drawers.insert(trx, {
        name: input.name,
        address: input.address,
        timezone: input.timezone,
        latitude: input.latitude,
        longitude: input.longitude,
        pickupInstructions: input.pickupInstructions ?? null,
      });
      await this.drawers.replaceHours(trx, newId, input.hours ?? []);
      const created = await this.drawers.find(trx, newId);
      await this.audit.record(trx, {
        actor,
        action: 'drawer.created',
        entityType: 'drawer',
        entityId: newId,
        after: { ...(created && snapshot(created)), hours: input.hours ?? [] },
      });
      return newId;
    });
    return this.get(access, id);
  }

  async update(
    actor: Actor,
    access: DrawerAccess,
    id: string,
    patch: {
      name?: string | undefined;
      address?: string | undefined;
      timezone?: string | undefined;
      status?: 'active' | 'temporarily_closed' | 'inactive' | undefined;
      pickupInstructions?: string | null | undefined;
      latitude?: number | undefined;
      longitude?: number | undefined;
    },
  ): Promise<DrawerDetails> {
    if (patch.timezone !== undefined) this.checkTimeZone(patch.timezone);
    if ((patch.latitude === undefined) !== (patch.longitude === undefined)) {
      throw invalidDrawerField('latitude', 'send latitude and longitude together');
    }
    await withTransaction(this.db, async (trx) => {
      if (!(await this.drawers.lock(trx, id)) || !accessIncludes(access, id))
        throw drawerNotFound();
      const before = await this.drawers.find(trx, id);
      if (!before) throw drawerNotFound();
      if (
        patch.status === 'inactive' &&
        before.status !== 'inactive' &&
        (await this.drawers.futureBookings(trx, id, this.clock.now())) > 0
      ) {
        throw new AppError({
          status: 409,
          code: 'HAS_FUTURE_BOOKINGS',
          detail: 'This drawer still has upcoming bookings',
        });
      }
      await this.drawers.update(trx, id, {
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.address !== undefined && { address: patch.address }),
        ...(patch.timezone !== undefined && { timezone: patch.timezone }),
        ...(patch.status !== undefined && { status: patch.status }),
        ...(patch.pickupInstructions !== undefined && {
          pickupInstructions: patch.pickupInstructions,
        }),
        ...(patch.latitude !== undefined &&
          patch.longitude !== undefined && {
            location: { latitude: patch.latitude, longitude: patch.longitude },
          }),
      });
      const after = await this.drawers.find(trx, id);
      await this.audit.record(trx, {
        actor,
        action: 'drawer.updated',
        entityType: 'drawer',
        entityId: id,
        before: snapshot(before),
        after: after && snapshot(after),
      });
    });
    return this.get(access, id);
  }

  async setHours(
    actor: Actor,
    access: DrawerAccess,
    id: string,
    hours: HoursInput[],
  ): Promise<DrawerDetails> {
    this.checkHours(hours);
    await withTransaction(this.db, async (trx) => {
      if (!(await this.drawers.lock(trx, id)) || !accessIncludes(access, id))
        throw drawerNotFound();
      const before = await this.drawers.hoursFor(trx, [id]);
      await this.drawers.replaceHours(trx, id, hours);
      await this.audit.record(trx, {
        actor,
        action: 'drawer.hours_set',
        entityType: 'drawer',
        entityId: id,
        before: { hours: before.map(hoursView) },
        after: { hours },
      });
    });
    return this.get(access, id);
  }

  // ── closures ──────────────────────────────────────────────────────────────────────────────────────
  async listClosures(access: DrawerAccess, id: string): Promise<ClosureRow[]> {
    if (!(await this.drawers.find(this.db, id)) || !accessIncludes(access, id))
      throw drawerNotFound();
    return this.drawers.closuresFor(this.db, [id]);
  }

  async addClosure(
    actor: Actor,
    access: DrawerAccess,
    id: string,
    input: { from: Date; to: Date; reason?: string | null | undefined },
  ): Promise<ClosureRow> {
    if (input.to.getTime() <= input.from.getTime()) {
      throw invalidDrawerField('to', 'must be later than from');
    }
    try {
      const closureId = await withTransaction(this.db, async (trx) => {
        if (!(await this.drawers.lock(trx, id)) || !accessIncludes(access, id))
          throw drawerNotFound();
        const created = await this.drawers.insertClosure(trx, {
          drawerId: id,
          from: input.from,
          to: input.to,
          reason: input.reason ?? null,
          createdBy: actor.id as string,
        });
        await this.audit.record(trx, {
          actor,
          action: 'drawer.closure_added',
          entityType: 'drawer',
          entityId: id,
          after: {
            closureId: created,
            from: input.from,
            to: input.to,
            reason: input.reason ?? null,
          },
        });
        return created;
      });
      const closure = await this.drawers.findClosure(this.db, id, closureId);
      if (!closure) throw closureNotFound();
      return closure;
    } catch (error) {
      if (pgErrorCode(error) === EXCLUDE_VIOLATION || error instanceof UniqueViolationError) {
        throw invalidDrawerField('from', 'overlaps another closure of this drawer');
      }
      throw error;
    }
  }

  async removeClosure(
    actor: Actor,
    access: DrawerAccess,
    id: string,
    closureId: string,
  ): Promise<void> {
    await withTransaction(this.db, async (trx) => {
      if (!(await this.drawers.lock(trx, id)) || !accessIncludes(access, id))
        throw drawerNotFound();
      const closure = await this.drawers.findClosure(trx, id, closureId);
      if (!closure) throw closureNotFound();
      await this.drawers.deleteClosure(trx, closureId);
      await this.audit.record(trx, {
        actor,
        action: 'drawer.closure_removed',
        entityType: 'drawer',
        entityId: id,
        before: { closureId, from: closure.starts_at, to: closure.ends_at, reason: closure.reason },
      });
    });
  }

  // ── helpers ───────────────────────────────────────────────────────────────────────────────────────
  private checkTimeZone(timezone: string): void {
    if (!isValidTimeZone(timezone)) {
      throw invalidDrawerField('timezone', 'use an IANA time zone name such as Asia/Kolkata');
    }
  }

  private checkHours(hours: readonly HoursInput[]): void {
    const problems = validateHours(hours);
    if (problems.length > 0) {
      throw new AppError({
        status: 422,
        code: 'VALIDATION_FAILED',
        detail: 'Request validation failed',
        errors: problems,
      });
    }
  }

  private async withDetails(rows: DrawerRow[]): Promise<DrawerDetails[]> {
    const ids = rows.map((r) => r.id);
    const [hours, counts] = await Promise.all([
      this.drawers.hoursFor(this.db, ids),
      this.drawers.assetCounts(this.db, ids),
    ]);
    return rows.map((drawer) => ({
      drawer,
      hours: hours.filter((h) => h.drawer_id === drawer.id),
      assetCount: counts.get(drawer.id) ?? 0,
    }));
  }
}

const hoursView = (h: HoursRow) => ({
  weekday: h.weekday,
  opensAt: h.opens_at,
  closesAt: h.closes_at,
});

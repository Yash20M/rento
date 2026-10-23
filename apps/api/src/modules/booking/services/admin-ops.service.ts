import { Inject, Injectable } from '@nestjs/common';
import { type Kysely, sql } from 'kysely';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import { AppError } from '../../../common/errors/app-error';
import { SlotTakenError, pgErrorCode } from '../../../db/errors';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { type Tx, withTransaction } from '../../../db/transaction';
import { type DrawerAccess, accessIncludes } from '../../access-control';
import { type Actor, AuditLog } from '../../reporting-audit';
import { BookingRepository } from '../data/booking.repository';
import { MINUTE_MS, bookingField, bookingNotFound, invalidState } from '../domain/booking-rules';
import type {
  BlockDto,
  CreateBlockDto,
  ImpactBookingDto,
  ImpactDto,
  ReassignOptionDto,
  ScheduleDto,
} from '../http/admin-ops.dto';
import type { BookingDto } from '../http/bookings.dto';
import { BookingService } from './booking.service';

const DAY_MS = 86_400_000;
const MAX_BLOCK_DAYS = 366;
const MAX_SCHEDULE_DAYS = 31;

const notFound = (what: string): AppError =>
  new AppError({ status: 404, code: 'NOT_FOUND', detail: `${what} not found` });

interface AssetLite {
  id: string;
  drawer_id: string;
  item_model_id: string;
  asset_code: string;
  status: string;
}

interface OccupancyRow {
  id: string;
  asset_id: string;
  kind: string;
  booking_id: string | null;
  blocked_from: Date;
  blocked_until: Date;
  reason: string | null;
  created_at: Date;
}

const blockView = (o: OccupancyRow): BlockDto => ({
  id: o.id,
  assetId: o.asset_id,
  kind: o.kind,
  startsAt: o.blocked_from.toISOString(),
  endsAt: o.blocked_until.toISOString(),
  reason: o.reason,
  createdAt: o.created_at.toISOString(),
});

/**
 * Operations staff do on top of bookings (README §9.9, §13.3): move a booking to another unit, block a unit for
 * maintenance and see the day. Everything that touches the ledger goes through the exclusion constraint, so none of it
 * can double-book a unit even when it races with customers.
 */
@Injectable()
export class AdminOpsService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly bookings: BookingRepository,
    private readonly service: BookingService,
    private readonly audit: AuditLog,
  ) {}

  // ── reassign ────────────────────────────────────────────────────────────────────────────────────
  /** Free units of the same model and drawer for exactly this booking's window (the unit it has now excluded). */
  async reassignOptions(access: DrawerAccess, id: string): Promise<ReassignOptionDto[]> {
    const row = await this.bookings.view(this.db, id);
    if (!row || !accessIncludes(access, row.drawer_id)) throw bookingNotFound();
    if (row.status !== 'confirmed' && row.status !== 'held') return [];
    const until = new Date(row.ends_at.getTime() + row.buffer_min * MINUTE_MS);
    const result = await sql<{ id: string; asset_code: string }>`
      SELECT a.id, a.asset_code FROM assets a
       WHERE a.drawer_id = ${row.drawer_id} AND a.item_model_id = ${row.item_model_id}
         AND a.status = 'available' AND a.id <> ${row.asset_id}
         AND NOT EXISTS (
               SELECT 1 FROM asset_occupancies o
               LEFT JOIN bookings ob ON ob.id = o.booking_id
                WHERE o.asset_id = a.id AND o.released_at IS NULL
                  AND o.during && tstzrange(${row.starts_at}, ${until}, '[)')
                  AND NOT COALESCE(ob.status = 'held' AND ob.hold_expires_at <= ${this.clock.now()}, false))
       ORDER BY a.asset_code`.execute(this.db);
    return result.rows.map((r) => ({ assetId: r.id, assetCode: r.asset_code }));
  }

  /**
   * Moves a booking that has not started to another unit of the same model — one transaction: the old occupancy is
   * released and the new one inserted together, so a refusal (the target is taken) leaves the booking exactly as it was.
   */
  async reassign(
    actor: Actor,
    access: DrawerAccess,
    id: string,
    input: { reason: string; assetId?: string | undefined },
  ): Promise<BookingDto> {
    await withTransaction(this.db, async (trx) => {
      const row = await this.bookings.lock(trx, id);
      if (!row || !accessIncludes(access, row.drawer_id)) throw bookingNotFound();
      if (row.status !== 'confirmed' && row.status !== 'held') {
        throw invalidState('Only a booking that has not started can be moved to another unit');
      }
      const now = this.clock.now();
      const until = new Date(row.ends_at.getTime() + row.buffer_min * MINUTE_MS);

      let targetId = input.assetId;
      if (targetId !== undefined) {
        if (targetId === row.asset_id) throw bookingField('assetId', 'is the unit it already has');
        const target = await this.lockAsset(trx, targetId);
        if (
          !target ||
          target.drawer_id !== row.drawer_id ||
          target.item_model_id !== row.item_model_id
        ) {
          throw bookingField('assetId', 'is not a unit of this model in this drawer');
        }
        if (target.status !== 'available') throw invalidState('That unit is not available');
      } else {
        targetId = await this.bookings.candidate(trx, {
          drawerId: row.drawer_id,
          itemModelId: row.item_model_id,
          from: row.starts_at,
          to: until,
          exclude: [row.asset_id],
          now,
          skipLocked: false,
        });
        if (!targetId) throw new SlotTakenError();
      }

      const previous = await this.assetCode(trx, row.asset_id);
      await this.bookings.releaseOccupancy(trx, id, now);
      // The exclusion constraint decides. A refusal (23P01 → BOOKING_SLOT_TAKEN) rolls the release back too.
      await this.bookings.insertOccupancy(trx, id, targetId, row.starts_at, until);
      await trx
        .updateTable('bookings')
        .set({ asset_id: targetId, version: sql`version + 1` })
        .where('id', '=', id)
        .execute();
      const next = await this.assetCode(trx, targetId);
      await this.bookings.insertEvent(trx, {
        bookingId: id,
        from: row.status,
        to: row.status,
        actorId: actor.id,
        note: `Moved from unit ${previous} to ${next}: ${input.reason}`,
        at: now,
      });
      await this.audit.record(trx, {
        actor,
        action: 'booking.reassigned',
        entityType: 'booking',
        entityId: id,
        before: { assetId: row.asset_id, assetCode: previous },
        after: { assetId: targetId, assetCode: next },
        reason: input.reason,
      });
    });
    return this.service.present(this.db, id);
  }

  // ── blocks ──────────────────────────────────────────────────────────────────────────────────────
  async listBlocks(access: DrawerAccess, assetId: string): Promise<BlockDto[]> {
    await this.scopedAsset(this.db, access, assetId);
    const result = await sql<OccupancyRow>`
      SELECT o.id, o.asset_id, o.kind, o.booking_id, lower(o.during) AS blocked_from, upper(o.during) AS blocked_until,
             o.reason, o.created_at
        FROM asset_occupancies o
       WHERE o.asset_id = ${assetId} AND o.kind <> 'booking' AND o.released_at IS NULL
         AND upper(o.during) > ${this.clock.now()}
       ORDER BY lower(o.during)`.execute(this.db);
    return result.rows.map(blockView);
  }

  /** What stands in the way of blocking the unit for this window. Reads only. */
  async preview(
    access: DrawerAccess,
    assetId: string,
    from: string,
    to: string,
  ): Promise<ImpactDto> {
    const [start, end] = this.window(from, to);
    await this.scopedAsset(this.db, access, assetId);
    return this.impact(this.db, assetId, start, end);
  }

  async createBlock(
    actor: Actor,
    access: DrawerAccess,
    assetId: string,
    input: CreateBlockDto,
  ): Promise<BlockDto> {
    const [start, end] = this.window(input.startsAt, input.endsAt);
    const now = this.clock.now();
    if (end.getTime() <= now.getTime()) {
      throw bookingField('endsAt', 'must be in the future');
    }
    if (end.getTime() - start.getTime() > MAX_BLOCK_DAYS * DAY_MS) {
      throw bookingField('endsAt', `cannot be more than ${MAX_BLOCK_DAYS} days after the start`);
    }
    const kind = input.kind ?? 'maintenance';

    return withTransaction(this.db, async (trx) => {
      const asset = await this.scopedAsset(trx, access, assetId, true);
      // Holds that already ran out must not stand in the way.
      await this.bookings.expireHolds(trx, now, 50, {
        drawerId: asset.drawer_id,
        itemModelId: asset.item_model_id,
      });
      const impact = await this.impact(trx, assetId, start, end);
      if (!impact.clear) throw this.blocked(impact);

      await sql`SAVEPOINT block`.execute(trx);
      try {
        const inserted = await sql<{ id: string }>`
          INSERT INTO asset_occupancies (asset_id, kind, during, reason, created_by)
          VALUES (${assetId}, ${kind}, tstzrange(${start}, ${end}, '[)'), ${input.reason}, ${actor.id})
          RETURNING id`.execute(trx);
        await sql`RELEASE SAVEPOINT block`.execute(trx);
        const id = inserted.rows[0]!.id;
        await this.audit.record(trx, {
          actor,
          action: 'asset.blocked',
          entityType: 'asset',
          entityId: assetId,
          after: {
            blockId: id,
            kind,
            startsAt: start.toISOString(),
            endsAt: end.toISOString(),
            assetCode: asset.asset_code,
          },
          reason: input.reason,
        });
        return {
          id,
          assetId,
          kind,
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          reason: input.reason,
          createdAt: now.toISOString(),
        };
      } catch (error) {
        if (pgErrorCode(error) !== '23P01') throw error;
        // A customer got there between the check and the insert: the constraint has the last word.
        await sql`ROLLBACK TO SAVEPOINT block`.execute(trx);
        throw this.blocked(await this.impact(trx, assetId, start, end));
      }
    });
  }

  async releaseBlock(
    actor: Actor,
    access: DrawerAccess,
    assetId: string,
    blockId: string,
  ): Promise<void> {
    await withTransaction(this.db, async (trx) => {
      const asset = await this.scopedAsset(trx, access, assetId, true);
      const now = this.clock.now();
      const released = await sql<{ id: string }>`
        UPDATE asset_occupancies SET released_at = ${now}
         WHERE id = ${blockId} AND asset_id = ${assetId} AND kind <> 'booking' AND released_at IS NULL
        RETURNING id`.execute(trx);
      if (released.rows.length === 0) throw notFound('Block');
      await this.audit.record(trx, {
        actor,
        action: 'asset.unblocked',
        entityType: 'asset',
        entityId: assetId,
        before: { blockId, assetCode: asset.asset_code },
      });
    });
  }

  // ── the day at a drawer ─────────────────────────────────────────────────────────────────────────
  async schedule(
    access: DrawerAccess,
    drawerId: string,
    from: string,
    to: string,
  ): Promise<ScheduleDto> {
    const [start, end] = this.window(from, to);
    if (end.getTime() - start.getTime() > MAX_SCHEDULE_DAYS * DAY_MS) {
      throw bookingField('endsAt', `cannot be more than ${MAX_SCHEDULE_DAYS} days after the start`);
    }
    if (!accessIncludes(access, drawerId)) throw notFound('Drawer');
    const drawer = await this.db
      .selectFrom('drawers')
      .select(['id', 'name', 'timezone'])
      .where('id', '=', drawerId)
      .executeTakeFirst();
    if (!drawer) throw notFound('Drawer');

    const assets = await sql<{
      id: string;
      asset_code: string;
      status: string;
      model: string;
    }>`
      SELECT a.id, a.asset_code, a.status, m.name AS model
        FROM assets a JOIN item_models m ON m.id = a.item_model_id
       WHERE a.drawer_id = ${drawerId} AND a.status <> 'retired'
       ORDER BY m.name, a.asset_code`.execute(this.db);
    const entries = await sql<
      OccupancyRow & {
        status: string | null;
        starts_at: Date | null;
        ends_at: Date | null;
        customer: string | null;
      }
    >`
      SELECT o.id, o.asset_id, o.kind, o.booking_id, lower(o.during) AS blocked_from, upper(o.during) AS blocked_until,
             o.reason, o.created_at, b.status, b.starts_at, b.ends_at,
             COALESCE(u.display_name, u.email::text) AS customer
        FROM asset_occupancies o
        JOIN assets a ON a.id = o.asset_id
        LEFT JOIN bookings b ON b.id = o.booking_id
        LEFT JOIN users u ON u.id = b.user_id
       WHERE a.drawer_id = ${drawerId} AND o.released_at IS NULL
         AND o.during && tstzrange(${start}, ${end}, '[)')
       ORDER BY lower(o.during)`.execute(this.db);

    return {
      drawerId: drawer.id,
      drawerName: drawer.name,
      timezone: drawer.timezone,
      assets: assets.rows.map((a) => ({
        assetId: a.id,
        assetCode: a.asset_code,
        itemModel: a.model,
        status: a.status,
        entries: entries.rows
          .filter((e) => e.asset_id === a.id)
          .map((e) => ({
            kind: e.kind,
            blockedFrom: e.blocked_from.toISOString(),
            blockedUntil: e.blocked_until.toISOString(),
            ...(e.booking_id && {
              bookingId: e.booking_id,
              ...(e.status && { bookingStatus: e.status }),
              ...(e.starts_at && { startsAt: e.starts_at.toISOString() }),
              ...(e.ends_at && { endsAt: e.ends_at.toISOString() }),
              ...(e.customer && { customer: e.customer }),
            }),
            ...(e.booking_id === null && { blockId: e.id }),
            ...(e.reason && { reason: e.reason }),
          })),
      })),
    };
  }

  // ── helpers ─────────────────────────────────────────────────────────────────────────────────────
  private window(from: string, to: string): [Date, Date] {
    const start = new Date(from);
    const end = new Date(to);
    if (Number.isNaN(start.getTime())) throw bookingField('startsAt', 'is not a valid time');
    if (Number.isNaN(end.getTime())) throw bookingField('endsAt', 'is not a valid time');
    if (end.getTime() <= start.getTime()) throw bookingField('endsAt', 'must be after the start');
    return [start, end];
  }

  private async impact(
    db: Kysely<Database> | Tx,
    assetId: string,
    start: Date,
    end: Date,
  ): Promise<ImpactDto> {
    const rows = await sql<
      OccupancyRow & {
        status: string | null;
        starts_at: Date | null;
        ends_at: Date | null;
        customer: string | null;
      }
    >`
      SELECT o.id, o.asset_id, o.kind, o.booking_id, lower(o.during) AS blocked_from, upper(o.during) AS blocked_until,
             o.reason, o.created_at, b.status, b.starts_at, b.ends_at,
             COALESCE(u.display_name, u.email::text) AS customer
        FROM asset_occupancies o
        LEFT JOIN bookings b ON b.id = o.booking_id
        LEFT JOIN users u ON u.id = b.user_id
       WHERE o.asset_id = ${assetId} AND o.released_at IS NULL
         AND o.during && tstzrange(${start}, ${end}, '[)')
       ORDER BY lower(o.during)`.execute(db);
    const bookings: ImpactBookingDto[] = rows.rows
      .filter((r) => r.booking_id !== null)
      .map((r) => ({
        bookingId: r.booking_id!,
        status: r.status ?? 'unknown',
        startsAt: (r.starts_at ?? r.blocked_from).toISOString(),
        endsAt: (r.ends_at ?? r.blocked_until).toISOString(),
        customer: r.customer,
      }));
    const blocks = rows.rows.filter((r) => r.booking_id === null).map(blockView);
    return { bookings, blocks, clear: bookings.length === 0 && blocks.length === 0 };
  }

  /** Customer names stay out of this error: whoever may block units may not be allowed to see customers. */
  private blocked(impact: ImpactDto): AppError {
    return new AppError({
      status: 409,
      code: 'HAS_FUTURE_BOOKINGS',
      detail:
        impact.bookings.length > 0
          ? `${impact.bookings.length} booking(s) are in the way. Move or cancel them first`
          : 'The unit is already blocked during part of this time',
      errors: [
        ...impact.bookings.map((b) => ({
          field: 'bookings',
          message: `${b.bookingId} (${b.status}) ${b.startsAt} – ${b.endsAt}`,
        })),
        ...impact.blocks.map((b) => ({
          field: 'blocks',
          message: `${b.kind} ${b.startsAt} – ${b.endsAt}`,
        })),
      ],
    });
  }

  private async lockAsset(trx: Tx, id: string): Promise<AssetLite | undefined> {
    return trx
      .selectFrom('assets')
      .select(['id', 'drawer_id', 'item_model_id', 'asset_code', 'status'])
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst();
  }

  private async scopedAsset(
    db: Kysely<Database> | Tx,
    access: DrawerAccess,
    id: string,
    lock = false,
  ): Promise<AssetLite> {
    const query = db
      .selectFrom('assets')
      .select(['id', 'drawer_id', 'item_model_id', 'asset_code', 'status'])
      .where('id', '=', id);
    const asset = await (lock ? query.forUpdate() : query).executeTakeFirst();
    if (!asset || !accessIncludes(access, asset.drawer_id)) throw notFound('Asset');
    return asset;
  }

  private async assetCode(trx: Tx, id: string): Promise<string> {
    const row = await trx
      .selectFrom('assets')
      .select('asset_code')
      .where('id', '=', id)
      .executeTakeFirst();
    return row?.asset_code ?? id;
  }
}

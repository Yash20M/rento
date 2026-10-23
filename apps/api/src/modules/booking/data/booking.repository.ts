import { Injectable } from '@nestjs/common';
import { type Kysely, type Selectable, sql } from 'kysely';
import type { Bookings } from '../../../db/generated/database';
import type { Database } from '../../../db/kysely';
import type { BookingStatus } from '../domain/booking-rules';

type Db = Kysely<Database>;
export type BookingRow = Selectable<Bookings>;

/** A booking with the names a screen needs. */
export interface BookingView extends BookingRow {
  drawer_name: string;
  drawer_address: string;
  drawer_timezone: string;
  item_model_name: string;
  /** The product's cover photo (its first), as stored: a path on this API or a link. */
  item_photo: string | null;
  asset_code: string;
  customer_email: string | null;
  customer_name: string | null;
}

export interface BookingEventRow {
  id: string;
  from_status: string | null;
  to_status: string;
  actor_user_id: string | null;
  note: string | null;
  at: Date;
}

export interface AdminBookingFilter {
  drawerIds: readonly string[] | 'all';
  status?: string | undefined;
  drawerId?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  q?: string | undefined;
}

export interface Cursor {
  createdAt: string;
  id: string;
}

const VIEW = sql`
  b.*, d.name AS drawer_name, d.address AS drawer_address, d.timezone AS drawer_timezone,
  m.name AS item_model_name, m.photos->>0 AS item_photo, a.asset_code, u.email::text AS customer_email, u.display_name AS customer_name`;
const JOINS = sql`
  FROM bookings b
  JOIN drawers d ON d.id = b.drawer_id
  JOIN item_models m ON m.id = b.item_model_id
  JOIN assets a ON a.id = b.asset_id
  JOIN users u ON u.id = b.user_id`;

export const encodeCursor = (cursor: Cursor): string =>
  Buffer.from(`${cursor.createdAt}|${cursor.id}`).toString('base64url');
export function decodeCursor(value: string): Cursor | undefined {
  const [createdAt, id, ...rest] = Buffer.from(value, 'base64url').toString().split('|');
  if (!createdAt || !id || rest.length > 0 || Number.isNaN(Date.parse(createdAt))) return undefined;
  if (!/^[0-9a-f-]{36}$/.test(id)) return undefined;
  return { createdAt, id };
}

@Injectable()
export class BookingRepository {
  // ── reads ─────────────────────────────────────────────────────────────────────────────────────────
  async view(db: Db, id: string): Promise<BookingView | undefined> {
    const result = await sql<BookingView>`SELECT ${VIEW} ${JOINS} WHERE b.id = ${id}`.execute(db);
    return result.rows[0];
  }

  /** Locks the booking row: every state change goes through here so concurrent changes serialise. */
  async lock(db: Db, id: string): Promise<BookingRow | undefined> {
    return db
      .selectFrom('bookings')
      .selectAll()
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst();
  }

  async listForUser(db: Db, userId: string, status: string | undefined): Promise<BookingView[]> {
    const result = await sql<BookingView>`
      SELECT ${VIEW} ${JOINS}
      WHERE b.user_id = ${userId} ${status ? sql`AND b.status = ${status}` : sql``}
      ORDER BY b.created_at DESC, b.id DESC
      LIMIT 100`.execute(db);
    return result.rows;
  }

  async adminList(
    db: Db,
    filter: AdminBookingFilter,
    limit: number,
    cursor: Cursor | undefined,
  ): Promise<BookingView[]> {
    if (filter.drawerIds !== 'all' && filter.drawerIds.length === 0) return [];
    const like = filter.q ? `%${filter.q.replace(/[\\%_]/g, '\\$&')}%` : undefined;
    const result = await sql<BookingView>`
      SELECT ${VIEW} ${JOINS}
      WHERE ${
        filter.drawerIds === 'all'
          ? sql`true`
          : sql`b.drawer_id = ANY(${sql.val(filter.drawerIds)}::uuid[])`
      }
        ${filter.status ? sql`AND b.status = ${filter.status}` : sql``}
        ${filter.drawerId ? sql`AND b.drawer_id = ${filter.drawerId}` : sql``}
        ${filter.from ? sql`AND b.ends_at > ${filter.from}` : sql``}
        ${filter.to ? sql`AND b.starts_at < ${filter.to}` : sql``}
        ${
          like
            ? sql`AND (u.email::text ILIKE ${like} OR u.display_name ILIKE ${like} OR a.asset_code ILIKE ${like} OR b.id::text ILIKE ${like})`
            : sql``
        }
        ${
          cursor
            ? sql`AND (b.created_at, b.id) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`
            : sql``
        }
      ORDER BY b.created_at DESC, b.id DESC
      LIMIT ${limit}`.execute(db);
    return result.rows;
  }

  async events(db: Db, bookingId: string): Promise<BookingEventRow[]> {
    const result = await sql<BookingEventRow>`
      SELECT id, from_status, to_status, actor_user_id, note, at
      FROM booking_events WHERE booking_id = ${bookingId} ORDER BY at, id`.execute(db);
    return result.rows;
  }

  // ── the claim (README §9.4 steps 4–7) ────────────────────────────────────────────────────────────
  /**
   * Candidate asset for the window — an optimisation to reduce contention, NOT the guarantee (the exclusion
   * constraint is). `skipLocked` fans concurrent requests out over different units; the blocking variant is the
   * ADR-015 fallback that avoids false conflicts.
   */
  async candidate(
    db: Db,
    q: {
      drawerId: string;
      itemModelId: string;
      from: Date;
      to: Date;
      exclude: readonly string[];
      now: Date;
      skipLocked: boolean;
    },
  ): Promise<string | undefined> {
    const result = await sql<{ id: string }>`
      SELECT a.id
        FROM assets a
       WHERE a.drawer_id = ${q.drawerId}
         AND a.item_model_id = ${q.itemModelId}
         AND a.status = 'available'
         AND NOT (a.id = ANY(${sql.val(q.exclude)}::uuid[]))
         AND NOT EXISTS (
               SELECT 1 FROM asset_occupancies o
               LEFT JOIN bookings ob ON ob.id = o.booking_id
                WHERE o.asset_id = a.id AND o.released_at IS NULL
                  AND o.during && tstzrange(${q.from}, ${q.to}, '[)')
                  AND NOT COALESCE(ob.status = 'held' AND ob.hold_expires_at <= ${q.now}, false))
       ORDER BY a.asset_code
         ${q.skipLocked ? sql`FOR UPDATE OF a SKIP LOCKED` : sql`FOR UPDATE OF a`}
       LIMIT 1`.execute(db);
    return result.rows[0]?.id;
  }

  async insert(
    db: Db,
    b: {
      userId: string;
      assetId: string;
      drawerId: string;
      itemModelId: string;
      startsAt: Date;
      endsAt: Date;
      bufferMin: number;
      holdExpiresAt: Date;
      pricePaise: number;
      depositPaise: number;
    },
  ): Promise<BookingRow> {
    return db
      .insertInto('bookings')
      .values({
        user_id: b.userId,
        asset_id: b.assetId,
        drawer_id: b.drawerId,
        item_model_id: b.itemModelId,
        status: 'held',
        starts_at: b.startsAt,
        ends_at: b.endsAt,
        buffer_min: b.bufferMin,
        hold_expires_at: b.holdExpiresAt,
        price_paise: b.pricePaise,
        deposit_paise: b.depositPaise,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /** The ledger row. Throws `23P01` (mapped to `SlotTakenError`) when the constraint rejects the range. */
  async insertOccupancy(db: Db, bookingId: string, assetId: string, from: Date, to: Date) {
    await sql`
      INSERT INTO asset_occupancies (asset_id, kind, booking_id, during)
      VALUES (${assetId}, 'booking', ${bookingId}, tstzrange(${from}, ${to}, '[)'))`.execute(db);
  }

  // ── state changes (always on a row locked with `lock`) ───────────────────────────────────────────
  async setStatus(
    db: Db,
    id: string,
    status: BookingStatus,
    extra: {
      holdExpiresAt?: Date | null;
      cancelledBy?: string | null;
      cancelReason?: string | null;
    } = {},
  ): Promise<BookingRow> {
    return db
      .updateTable('bookings')
      .set({
        status,
        version: sql`version + 1`,
        ...(extra.holdExpiresAt !== undefined && { hold_expires_at: extra.holdExpiresAt }),
        ...(extra.cancelledBy !== undefined && { cancelled_by: extra.cancelledBy }),
        ...(extra.cancelReason !== undefined && { cancel_reason: extra.cancelReason }),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async releaseOccupancy(db: Db, bookingId: string, at: Date): Promise<void> {
    await db
      .updateTable('asset_occupancies')
      .set({ released_at: at })
      .where('booking_id', '=', bookingId)
      .where('released_at', 'is', null)
      .execute();
  }

  /** Early return: the unit is free again from `until` (a shorter range can never collide). */
  async shrinkOccupancy(db: Db, bookingId: string, until: Date): Promise<void> {
    await sql`
      UPDATE asset_occupancies
         SET during = tstzrange(lower(during), GREATEST(${until}::timestamptz, lower(during) + interval '1 millisecond'), '[)')
       WHERE booking_id = ${bookingId} AND released_at IS NULL AND upper(during) > ${until}::timestamptz`.execute(
      db,
    );
  }

  async hasLiveOccupancy(db: Db, bookingId: string): Promise<boolean> {
    const row = await db
      .selectFrom('asset_occupancies')
      .select('id')
      .where('booking_id', '=', bookingId)
      .where('released_at', 'is', null)
      .executeTakeFirst();
    return row !== undefined;
  }

  async insertEvent(
    db: Db,
    e: {
      bookingId: string;
      from: string | null;
      to: string;
      actorId: string | null;
      note?: string | null;
      meta?: unknown;
      at: Date;
    },
  ): Promise<void> {
    await db
      .insertInto('booking_events')
      .values({
        booking_id: e.bookingId,
        from_status: e.from,
        to_status: e.to,
        actor_user_id: e.actorId,
        note: e.note ?? null,
        meta: e.meta === undefined ? null : JSON.stringify(e.meta),
        at: e.at,
      })
      .execute();
  }

  async insertOutbox(db: Db, type: string, payload: unknown, at: Date): Promise<void> {
    await db
      .insertInto('outbox_events')
      .values({ type, payload: JSON.stringify(payload), created_at: at, available_at: at })
      .execute();
  }

  // ── sweeps ────────────────────────────────────────────────────────────────────────────────────────
  /**
   * Expires holds whose time ran out: status `expired`, occupancy released. `SKIP LOCKED` so a booking that is being
   * paid for right now is left alone and two workers never take the same row. Optionally limited to one drawer+model
   * (the lazy cleanup done by the booking path itself).
   */
  async expireHolds(
    db: Db,
    now: Date,
    limit: number,
    scope?: { drawerId: string; itemModelId: string },
  ): Promise<Array<{ id: string; user_id: string }>> {
    const result = await sql<{ id: string; user_id: string }>`
      WITH due AS (
        SELECT b.id FROM bookings b
         WHERE b.status = 'held' AND b.hold_expires_at <= ${now}
           ${scope ? sql`AND b.drawer_id = ${scope.drawerId} AND b.item_model_id = ${scope.itemModelId}` : sql``}
         ORDER BY b.hold_expires_at, b.id
         LIMIT ${limit}
           FOR UPDATE SKIP LOCKED),
      expired AS (
        UPDATE bookings SET status = 'expired', version = version + 1
          FROM due WHERE bookings.id = due.id
        RETURNING bookings.id, bookings.user_id),
      released AS (
        UPDATE asset_occupancies SET released_at = ${now}
         WHERE booking_id IN (SELECT id FROM expired) AND released_at IS NULL)
      SELECT id, user_id FROM expired`.execute(db);
    return result.rows;
  }

  /** `active` rentals past their end become `overdue`. */
  async markOverdue(db: Db, now: Date, limit: number): Promise<string[]> {
    return this.moveDue(db, 'active', 'overdue', sql`b.ends_at <= ${now}`, limit, null);
  }

  /** `confirmed` bookings nobody collected within the grace period become `no_show` and free the unit. */
  async markNoShow(db: Db, now: Date, graceMinutes: number, limit: number): Promise<string[]> {
    return this.moveDue(
      db,
      'confirmed',
      'no_show',
      sql`b.starts_at + (${graceMinutes} * interval '1 minute') <= ${now}`,
      limit,
      now,
    );
  }

  private async moveDue(
    db: Db,
    from: BookingStatus,
    to: BookingStatus,
    due: ReturnType<typeof sql>,
    limit: number,
    releaseAt: Date | null,
  ): Promise<string[]> {
    const release = releaseAt
      ? sql`, released AS (
          UPDATE asset_occupancies SET released_at = ${releaseAt}
           WHERE booking_id IN (SELECT id FROM moved) AND released_at IS NULL)`
      : sql``;
    const result = await sql<{ id: string }>`
      WITH due AS (
        SELECT b.id FROM bookings b
         WHERE b.status = ${from} AND ${due}
         ORDER BY b.starts_at, b.id
         LIMIT ${limit}
           FOR UPDATE SKIP LOCKED),
      moved AS (
        UPDATE bookings SET status = ${to}, version = version + 1
          FROM due WHERE bookings.id = due.id
        RETURNING bookings.id)
      ${release}
      SELECT id FROM moved`.execute(db);
    return result.rows.map((r) => r.id);
  }

  // ── outbox runner ─────────────────────────────────────────────────────────────────────────────────
  async claimOutbox(
    db: Db,
    now: Date,
    limit: number,
  ): Promise<Array<{ id: string; type: string; payload: unknown; attempts: number }>> {
    const result = await sql<{ id: string; type: string; payload: unknown; attempts: number }>`
      SELECT id, type, payload, attempts FROM outbox_events
       WHERE processed_at IS NULL AND available_at <= ${now}
       ORDER BY available_at, id
       LIMIT ${limit}
         FOR UPDATE SKIP LOCKED`.execute(db);
    return result.rows;
  }

  async markOutboxDone(db: Db, id: string, now: Date): Promise<void> {
    await db.updateTable('outbox_events').set({ processed_at: now }).where('id', '=', id).execute();
  }

  async markOutboxFailed(db: Db, id: string, error: string, retryAt: Date): Promise<void> {
    await db
      .updateTable('outbox_events')
      .set({ attempts: sql`attempts + 1`, last_error: error.slice(0, 500), available_at: retryAt })
      .where('id', '=', id)
      .execute();
  }
}

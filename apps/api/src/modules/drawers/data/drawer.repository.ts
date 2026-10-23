import { Injectable } from '@nestjs/common';
import { type Kysely, sql } from 'kysely';
import type { Database } from '../../../db/kysely';

type Db = Kysely<Database>;

export interface DrawerRow {
  id: string;
  name: string;
  address: string;
  timezone: string;
  status: string;
  pickup_instructions: string | null;
  photo_media_id: string | null;
  latitude: number;
  longitude: number;
}

export interface HoursRow {
  drawer_id: string;
  weekday: number;
  opens_at: string; // HH:MM:SS
  closes_at: string;
}

export interface ClosureRow {
  id: string;
  drawer_id: string;
  starts_at: Date;
  ends_at: Date;
  reason: string | null;
}

export interface NearbyRow extends DrawerRow {
  distance_meters: number;
}

export interface OccupancyRow {
  asset_id: string;
  starts_at: Date;
  ends_at: Date;
}

const COLUMNS = sql`
  d.id, d.name, d.address, d.timezone, d.status, d.pickup_instructions, d.photo_media_id,
  ST_Y(d.location::geometry)::float8 AS latitude,
  ST_X(d.location::geometry)::float8 AS longitude`;

@Injectable()
export class DrawerRepository {
  async list(db: Db, scope: readonly string[] | 'all', onlyActive = false): Promise<DrawerRow[]> {
    if (scope !== 'all' && scope.length === 0) return [];
    const result = await sql<DrawerRow>`
      SELECT ${COLUMNS} FROM drawers d
      WHERE ${onlyActive ? sql`d.status = 'active'` : sql`true`}
        AND ${scope === 'all' ? sql`true` : sql`d.id = ANY(${sql.val(scope)}::uuid[])`}
      ORDER BY d.name, d.id`.execute(db);
    return result.rows;
  }

  async find(db: Db, id: string): Promise<DrawerRow | undefined> {
    const result =
      await sql<DrawerRow>`SELECT ${COLUMNS} FROM drawers d WHERE d.id = ${id}`.execute(db);
    return result.rows[0];
  }

  async lock(db: Db, id: string): Promise<{ id: string; status: string } | undefined> {
    return db
      .selectFrom('drawers')
      .select(['id', 'status'])
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst();
  }

  async insert(
    db: Db,
    drawer: {
      name: string;
      address: string;
      timezone: string;
      latitude: number;
      longitude: number;
      pickupInstructions: string | null;
    },
  ): Promise<string> {
    // ST_MakePoint(longitude, latitude): longitude FIRST.
    const result = await sql<{ id: string }>`
      INSERT INTO drawers (name, address, timezone, location, pickup_instructions)
      VALUES (${drawer.name}, ${drawer.address}, ${drawer.timezone},
              ST_SetSRID(ST_MakePoint(${drawer.longitude}, ${drawer.latitude}), 4326)::geography,
              ${drawer.pickupInstructions})
      RETURNING id`.execute(db);
    return result.rows[0]!.id;
  }

  async update(
    db: Db,
    id: string,
    changes: {
      name?: string;
      address?: string;
      timezone?: string;
      status?: string;
      pickupInstructions?: string | null;
      location?: { latitude: number; longitude: number };
    },
  ): Promise<void> {
    const sets = [
      ...(changes.name !== undefined ? [sql`name = ${changes.name}`] : []),
      ...(changes.address !== undefined ? [sql`address = ${changes.address}`] : []),
      ...(changes.timezone !== undefined ? [sql`timezone = ${changes.timezone}`] : []),
      ...(changes.status !== undefined ? [sql`status = ${changes.status}`] : []),
      ...(changes.pickupInstructions !== undefined
        ? [sql`pickup_instructions = ${changes.pickupInstructions}`]
        : []),
      ...(changes.location
        ? [
            sql`location = ST_SetSRID(ST_MakePoint(${changes.location.longitude}, ${changes.location.latitude}), 4326)::geography`,
          ]
        : []),
      sql`updated_at = now()`,
    ];
    await sql`UPDATE drawers SET ${sql.join(sets, sql`, `)} WHERE id = ${id}`.execute(db);
  }

  // ── hours & closures ──────────────────────────────────────────────────────────────────────────────
  async hoursFor(db: Db, drawerIds: readonly string[]): Promise<HoursRow[]> {
    if (drawerIds.length === 0) return [];
    const rows = await db
      .selectFrom('drawer_hours')
      .select(['drawer_id', 'weekday', 'opens_at', 'closes_at'])
      .where('drawer_id', 'in', drawerIds)
      .orderBy('weekday')
      .execute();
    return rows as unknown as HoursRow[];
  }

  async replaceHours(
    db: Db,
    drawerId: string,
    hours: ReadonlyArray<{ weekday: number; opensAt: string; closesAt: string }>,
  ): Promise<void> {
    await db.deleteFrom('drawer_hours').where('drawer_id', '=', drawerId).execute();
    if (hours.length === 0) return;
    await db
      .insertInto('drawer_hours')
      .values(
        hours.map((h) => ({
          drawer_id: drawerId,
          weekday: h.weekday,
          opens_at: h.opensAt,
          closes_at: h.closesAt,
        })),
      )
      .execute();
  }

  async closuresFor(db: Db, drawerIds: readonly string[], from?: Date): Promise<ClosureRow[]> {
    if (drawerIds.length === 0) return [];
    const result = await sql<ClosureRow>`
      SELECT id, drawer_id, lower(during) AS starts_at, upper(during) AS ends_at, reason
      FROM drawer_closures
      WHERE drawer_id = ANY(${sql.val(drawerIds)}::uuid[])
        ${from ? sql`AND upper(during) > ${from}` : sql``}
      ORDER BY lower(during)`.execute(db);
    return result.rows;
  }

  async insertClosure(
    db: Db,
    closure: { drawerId: string; from: Date; to: Date; reason: string | null; createdBy: string },
  ): Promise<string> {
    const result = await sql<{ id: string }>`
      INSERT INTO drawer_closures (drawer_id, during, reason, created_by)
      VALUES (${closure.drawerId}, tstzrange(${closure.from}, ${closure.to}, '[)'), ${closure.reason}, ${closure.createdBy})
      RETURNING id`.execute(db);
    return result.rows[0]!.id;
  }

  async findClosure(db: Db, drawerId: string, id: string): Promise<ClosureRow | undefined> {
    const result = await sql<ClosureRow>`
      SELECT id, drawer_id, lower(during) AS starts_at, upper(during) AS ends_at, reason
      FROM drawer_closures WHERE id = ${id} AND drawer_id = ${drawerId}`.execute(db);
    return result.rows[0];
  }

  async deleteClosure(db: Db, id: string): Promise<void> {
    await db.deleteFrom('drawer_closures').where('id', '=', id).execute();
  }

  async futureBookings(db: Db, drawerId: string, now: Date): Promise<number> {
    const row = await db
      .selectFrom('bookings')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .where('drawer_id', '=', drawerId)
      .where('status', 'in', ['held', 'confirmed', 'active', 'overdue'])
      .where('ends_at', '>', now)
      .executeTakeFirstOrThrow();
    return Number(row.n);
  }

  async assetCounts(db: Db, drawerIds: readonly string[]): Promise<Map<string, number>> {
    if (drawerIds.length === 0) return new Map();
    const rows = await db
      .selectFrom('assets')
      .select(['drawer_id', (eb) => eb.fn.countAll<string>().as('n')])
      .where('drawer_id', 'in', drawerIds)
      .where('status', '<>', 'retired')
      .groupBy('drawer_id')
      .execute();
    return new Map(rows.map((r) => [r.drawer_id, Number(r.n)]));
  }

  // ── discovery ─────────────────────────────────────────────────────────────────────────────────────
  /** Active drawers within `radiusMeters`, nearest first (PostGIS KNN order backed by the GiST index). */
  async nearby(
    db: Db,
    point: { latitude: number; longitude: number },
    radiusMeters: number,
    limit: number,
  ): Promise<NearbyRow[]> {
    const origin = sql`ST_SetSRID(ST_MakePoint(${point.longitude}, ${point.latitude}), 4326)::geography`;
    const result = await sql<NearbyRow>`
      SELECT ${COLUMNS}, ST_Distance(d.location, ${origin})::float8 AS distance_meters
      FROM drawers d
      WHERE d.status = 'active' AND ST_DWithin(d.location, ${origin}, ${radiusMeters})
      ORDER BY d.location <-> ${origin}, d.id
      LIMIT ${limit}`.execute(db);
    return result.rows;
  }

  // ── inventory & availability ──────────────────────────────────────────────────────────────────────
  /** Active item models that have at least one non-retired asset in the drawer, with total / free-now counts. */
  async inventory(
    db: Db,
    drawerId: string,
    now: Date,
  ): Promise<Array<{ item_model_id: string; total: number; available_now: number }>> {
    const result = await sql<{ item_model_id: string; total: string; available_now: string }>`
      SELECT a.item_model_id,
             count(*) AS total,
             count(*) FILTER (
               WHERE a.status = 'available' AND NOT EXISTS (${this.activeOccupancySql(sql`a.id`, now, new Date(now.getTime() + 1))})
             ) AS available_now
      FROM assets a
      JOIN item_models m ON m.id = a.item_model_id AND m.status = 'active'
      WHERE a.drawer_id = ${drawerId} AND a.status <> 'retired'
      GROUP BY a.item_model_id`.execute(db);
    return result.rows.map((r) => ({
      item_model_id: r.item_model_id,
      total: Number(r.total),
      available_now: Number(r.available_now),
    }));
  }

  /** Per drawer: units of the model that are rentable and free right now. */
  async freeUnitsNow(
    db: Db,
    drawerIds: readonly string[],
    modelId: string,
    now: Date,
  ): Promise<Map<string, number>> {
    const result = await sql<{ drawer_id: string; n: string }>`
      SELECT a.drawer_id, count(*) AS n
      FROM assets a
      JOIN item_models m ON m.id = a.item_model_id AND m.status = 'active'
      WHERE a.drawer_id = ANY(${sql.val(drawerIds)}::uuid[])
        AND a.item_model_id = ${modelId} AND a.status = 'available'
        AND NOT EXISTS (${this.activeOccupancySql(sql`a.id`, now, new Date(now.getTime() + 1))})
      GROUP BY a.drawer_id`.execute(db);
    return new Map(result.rows.map((r) => [r.drawer_id, Number(r.n)]));
  }

  /** Does the asset have a live occupancy overlapping [from, to)? Ignores released rows and expired-but-unreleased holds. */
  activeOccupancySql(assetId: ReturnType<typeof sql>, from: Date, to: Date) {
    return sql`
      SELECT 1 FROM asset_occupancies o
      LEFT JOIN bookings b ON b.id = o.booking_id
      WHERE o.asset_id = ${assetId} AND o.released_at IS NULL
        AND o.during && tstzrange(${from}, ${to}, '[)')
        AND NOT COALESCE(b.status = 'held' AND b.hold_expires_at <= ${from}, false)`;
  }

  /** Assets of a model in a drawer that are rentable at all (status `available`). */
  async rentableAssets(db: Db, drawerId: string, modelId: string): Promise<string[]> {
    const rows = await db
      .selectFrom('assets')
      .select('id')
      .where('drawer_id', '=', drawerId)
      .where('item_model_id', '=', modelId)
      .where('status', '=', 'available')
      .execute();
    return rows.map((r) => r.id);
  }

  /** Live occupancies of these assets that touch [from, to). */
  async occupancies(
    db: Db,
    assetIds: readonly string[],
    from: Date,
    to: Date,
    now: Date,
  ): Promise<OccupancyRow[]> {
    if (assetIds.length === 0) return [];
    const result = await sql<OccupancyRow>`
      SELECT o.asset_id, lower(o.during) AS starts_at, upper(o.during) AS ends_at
      FROM asset_occupancies o
      LEFT JOIN bookings b ON b.id = o.booking_id
      WHERE o.asset_id = ANY(${sql.val(assetIds)}::uuid[])
        AND o.released_at IS NULL
        AND o.during && tstzrange(${from}, ${to}, '[)')
        AND NOT COALESCE(b.status = 'held' AND b.hold_expires_at <= ${now}, false)
      ORDER BY o.asset_id, lower(o.during)`.execute(db);
    return result.rows;
  }
}

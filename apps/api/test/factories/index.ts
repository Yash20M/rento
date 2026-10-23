import { randomUUID } from 'node:crypto';
import { type Insertable, type Kysely, type Selectable, sql } from 'kysely';
import type { Database } from '../../src/db/kysely';
import type {
  Assets,
  AssetOccupancies,
  Bookings,
  Categories,
  Drawers,
  ItemModels,
  Users,
} from '../../src/db/generated/database';

/** `[from,to)` tstzrange literal from two ISO instants (or Dates). */
export function range(from: string | Date, to: string | Date): string {
  const iso = (value: string | Date) => (value instanceof Date ? value.toISOString() : value);
  return `[${iso(from)},${iso(to)})`;
}

/** Half-open range on 2030-01-01 from two `HH:mm` UTC times — the date tests conventionally use. */
export const slot = (from: string, to: string): string =>
  range(`2030-01-01T${from}:00Z`, `2030-01-01T${to}:00Z`);

export type DrawerOverrides = Partial<Omit<Insertable<Drawers>, 'location'>> & {
  /** Longitude first, like `ST_MakePoint(lng, lat)`. */
  lng?: number;
  lat?: number;
};
export type OccupancyOverrides = Partial<Omit<Insertable<AssetOccupancies>, 'during'>> & {
  during?: string;
};

/**
 * Row factories for DB tests. Each call inserts one valid row, creating any missing parent rows, and returns
 * the inserted row. Unique fields get a per-factory-instance random tag so factories never collide.
 */
export function createFactories(db: Kysely<Database>) {
  const tag = randomUUID().slice(0, 8);
  let sequence = 0;
  const next = () => {
    sequence += 1;
    return `${tag}-${sequence}`;
  };

  // Pass `email: null` explicitly for a user without an email.
  const user = async (overrides: Partial<Insertable<Users>> = {}): Promise<Selectable<Users>> =>
    db
      .insertInto('users')
      .values({ email: `user-${next()}@example.com`, ...overrides })
      .returningAll()
      .executeTakeFirstOrThrow();

  const category = async (
    overrides: Partial<Insertable<Categories>> = {},
  ): Promise<Selectable<Categories>> => {
    const n = next();
    return db
      .insertInto('categories')
      .values({ name: `Category ${n}`, slug: `category-${n}`, ...overrides })
      .returningAll()
      .executeTakeFirstOrThrow();
  };

  const drawer = async (overrides: DrawerOverrides = {}): Promise<Selectable<Drawers>> => {
    const { lng = 77.5946, lat = 12.9716, ...rest } = overrides;
    const n = next();
    return db
      .insertInto('drawers')
      .values({
        name: `Drawer ${n}`,
        address: `${n} Test Street`,
        timezone: 'Asia/Kolkata',
        location: sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`,
        ...rest,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  };

  const itemModel = async (
    overrides: Partial<Insertable<ItemModels>> = {},
  ): Promise<Selectable<ItemModels>> => {
    const categoryId = overrides.category_id ?? (await category()).id;
    return db
      .insertInto('item_models')
      .values({
        name: `Model ${next()}`,
        price_per_slot_paise: 4900,
        slot_minutes: 30,
        min_duration_min: 30,
        max_duration_min: 480,
        ...overrides,
        category_id: categoryId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  };

  const asset = async (
    overrides: Partial<Insertable<Assets>> = {},
  ): Promise<Selectable<Assets>> => {
    const itemModelId = overrides.item_model_id ?? (await itemModel()).id;
    const drawerId = overrides.drawer_id ?? (await drawer()).id;
    return db
      .insertInto('assets')
      .values({
        asset_code: `AST-${next()}`,
        ...overrides,
        item_model_id: itemModelId,
        drawer_id: drawerId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  };

  const booking = async (
    overrides: Partial<Insertable<Bookings>> = {},
  ): Promise<Selectable<Bookings>> => {
    const owner = overrides.asset_id
      ? await db
          .selectFrom('assets')
          .select(['id', 'drawer_id', 'item_model_id'])
          .where('id', '=', overrides.asset_id)
          .executeTakeFirstOrThrow()
      : await asset();
    const status = overrides.status ?? 'confirmed';
    return db
      .insertInto('bookings')
      .values({
        status,
        starts_at: '2030-01-01T10:00:00Z',
        ends_at: '2030-01-01T11:00:00Z',
        price_paise: 4900,
        ...(status === 'held' && { hold_expires_at: '2030-01-01T09:10:00Z' }),
        ...overrides,
        user_id: overrides.user_id ?? (await user()).id,
        asset_id: owner.id,
        drawer_id: overrides.drawer_id ?? owner.drawer_id,
        item_model_id: overrides.item_model_id ?? owner.item_model_id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  };

  const occupancy = async (
    overrides: OccupancyOverrides = {},
  ): Promise<Selectable<AssetOccupancies>> => {
    const { during = slot('10:00', '11:00'), ...rest } = overrides;
    const assetId = rest.asset_id ?? (await asset()).id;
    const kind = rest.kind ?? 'maintenance';
    // An explicit `booking_id` (even null) is respected so tests can build invalid combinations.
    const bookingId =
      rest.booking_id !== undefined
        ? rest.booking_id
        : kind === 'booking'
          ? (await booking({ asset_id: assetId })).id
          : null;
    return db
      .insertInto('asset_occupancies')
      .values({
        ...rest,
        kind,
        asset_id: assetId,
        booking_id: bookingId,
        during: sql`${during}::tstzrange`,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  };

  return { user, category, drawer, itemModel, asset, booking, occupancy };
}

export type Factories = ReturnType<typeof createFactories>;

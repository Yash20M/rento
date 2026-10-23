import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { expectPgError } from '../support/db/pg-assert';
import { type Factories, createFactories } from '../factories';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';

const CHECK_VIOLATION = '23514';
const UNIQUE_VIOLATION = '23505';
const FK_VIOLATION = '23503';

let db: TestDatabase;
let f: Factories;
let world: { userId: string; drawerId: string; itemModelId: string };
let asset: string;
beforeAll(async () => {
  db = await createTestDatabase();
  f = createFactories(db.db);
  const model = await f.itemModel();
  const drawer = await f.drawer();
  world = { userId: (await f.user()).id, drawerId: drawer.id, itemModelId: model.id };
  asset = (await f.asset({ item_model_id: model.id, drawer_id: drawer.id })).id;
});
afterAll(async () => {
  await db.drop();
});

describe('bookings', () => {
  it('D-10 accepts a valid confirmed booking and a held booking with expiry', async () => {
    await f.booking({ asset_id: asset });
    await f.booking({ asset_id: asset, status: 'held', hold_expires_at: '2030-01-01T09:10:00Z' });
  });

  it('D-10a rejects ends_at <= starts_at', async () => {
    for (const endsAt of ['2030-01-01T10:00:00Z', '2030-01-01T09:00:00Z']) {
      await expectPgError(
        f.booking({ asset_id: asset, starts_at: '2030-01-01T10:00:00Z', ends_at: endsAt }),
        { code: CHECK_VIOLATION, constraint: 'bookings_valid_period' },
      );
    }
  });

  it('D-10b rejects a held booking without hold_expires_at', async () => {
    await expectPgError(f.booking({ asset_id: asset, status: 'held', hold_expires_at: null }), {
      code: CHECK_VIOLATION,
      constraint: 'bookings_held_has_expiry',
    });
  });

  it('D-10c rejects an unknown status', async () => {
    await expectPgError(f.booking({ asset_id: asset, status: 'bogus' }), {
      code: CHECK_VIOLATION,
      constraint: 'bookings_status_check',
    });
  });

  it('D-10d rejects non-INR currency and negative money', async () => {
    const base = [world.userId, asset, world.drawerId, world.itemModelId];
    const insert = (currency: string, price: number, deposit: number) =>
      db.pool.query(
        `INSERT INTO bookings (user_id, asset_id, drawer_id, item_model_id, status, starts_at, ends_at,
                               price_paise, deposit_paise, currency)
         VALUES ($1,$2,$3,$4,'confirmed','2030-01-01T10:00Z','2030-01-01T11:00Z',$5,$6,$7)`,
        [...base, price, deposit, currency],
      );

    await expectPgError(insert('USD', 100, 0), {
      code: CHECK_VIOLATION,
      constraint: 'bookings_currency_check',
    });
    await expectPgError(insert('INR', -1, 0), {
      code: CHECK_VIOLATION,
      constraint: 'bookings_price_paise_check',
    });
    await expectPgError(insert('INR', 100, -5), {
      code: CHECK_VIOLATION,
      constraint: 'bookings_deposit_paise_check',
    });
  });

  it('D-10e enforces foreign keys', async () => {
    await expectPgError(
      db.pool.query(
        `INSERT INTO bookings (user_id, asset_id, drawer_id, item_model_id, status, starts_at, ends_at, price_paise)
         VALUES ($1,$2,$3,$4,'confirmed','2030-01-01T10:00Z','2030-01-01T11:00Z',100)`,
        [randomUUID(), asset, world.drawerId, world.itemModelId],
      ),
      { code: FK_VIOLATION },
    );
  });
});

describe('reference data', () => {
  it('D-11a asset_code is unique', async () => {
    const code = `DUP-${randomUUID().slice(0, 8)}`;
    const insert = () =>
      db.pool.query(
        'INSERT INTO assets (asset_code, item_model_id, drawer_id) VALUES ($1, $2, $3)',
        [code, world.itemModelId, world.drawerId],
      );
    await insert();
    await expectPgError(insert(), { code: UNIQUE_VIOLATION, constraint: 'assets_asset_code_key' });
  });

  it('D-11b asset needs an existing model and drawer; status is constrained', async () => {
    const insert = (modelId: string, drawerId: string, status = 'available') =>
      db.pool.query(
        'INSERT INTO assets (asset_code, item_model_id, drawer_id, status) VALUES ($1, $2, $3, $4)',
        [`X-${randomUUID().slice(0, 8)}`, modelId, drawerId, status],
      );
    await expectPgError(insert(randomUUID(), world.drawerId), { code: FK_VIOLATION });
    await expectPgError(insert(world.itemModelId, randomUUID()), { code: FK_VIOLATION });
    await expectPgError(insert(world.itemModelId, world.drawerId, 'stolen'), {
      code: CHECK_VIOLATION,
      constraint: 'assets_status_check',
    });
  });

  it('D-11c item_model sanity checks', async () => {
    const categoryId = (
      await db.pool.query<{ id: string }>(
        `INSERT INTO categories (name, slug) VALUES ('Cat', $1) RETURNING id`,
        [`cat-${randomUUID()}`],
      )
    ).rows[0]?.id;
    const insert = (price: number, slot: number, min: number, max: number) =>
      db.pool.query(
        `INSERT INTO item_models (category_id, name, price_per_slot_paise, slot_minutes,
                                  min_duration_min, max_duration_min)
         VALUES ($1, 'M', $2, $3, $4, $5)`,
        [categoryId, price, slot, min, max],
      );

    await insert(100, 30, 30, 60);
    await expectPgError(insert(-1, 30, 30, 60), { code: CHECK_VIOLATION });
    await expectPgError(insert(100, 0, 30, 60), { code: CHECK_VIOLATION });
    await expectPgError(insert(100, 30, 0, 60), { code: CHECK_VIOLATION });
    await expectPgError(insert(100, 30, 60, 30), { code: CHECK_VIOLATION });
  });

  it('D-11d category cannot be its own parent; slug is unique', async () => {
    const slug = `s-${randomUUID()}`;
    const created = await db.pool.query<{ id: string }>(
      'INSERT INTO categories (name, slug) VALUES ($1, $1) RETURNING id',
      [slug],
    );
    await expectPgError(
      db.pool.query('INSERT INTO categories (name, slug) VALUES ($1, $1)', [slug]),
      {
        code: UNIQUE_VIOLATION,
      },
    );
    await expectPgError(
      db.pool.query('UPDATE categories SET parent_id = id WHERE id = $1', [created.rows[0]?.id]),
      { code: CHECK_VIOLATION },
    );
  });

  it('D-12 emails are case-insensitively unique, many NULLs allowed, status constrained', async () => {
    const email = `Case-${randomUUID().slice(0, 6)}@Example.com`;
    await f.user({ email });
    await expectPgError(f.user({ email: email.toLowerCase() }), { code: UNIQUE_VIOLATION });

    await f.user({ email: null });
    await f.user({ email: null });

    await expectPgError(db.pool.query(`INSERT INTO users (status) VALUES ('banished')`), {
      code: CHECK_VIOLATION,
      constraint: 'users_status_check',
    });
  });
});

describe('geography & triggers', () => {
  it('D-13 stores longitude first: ST_X = lng, ST_Y = lat', async () => {
    const id = (await f.drawer({ lng: 77.5946, lat: 12.9716 })).id;
    const row = await db.pool.query<{ x: number; y: number }>(
      'SELECT ST_X(location::geometry) AS x, ST_Y(location::geometry) AS y FROM drawers WHERE id = $1',
      [id],
    );
    expect(row.rows[0]?.x).toBeCloseTo(77.5946, 6);
    expect(row.rows[0]?.y).toBeCloseTo(12.9716, 6);
  });

  it('D-13b radius queries work on the geography column (≈1.1 km per 0.01° latitude)', async () => {
    const a = (await f.drawer({ lng: 77.5, lat: 12.9 })).id;
    const b = (await f.drawer({ lng: 77.5, lat: 12.91 })).id;
    const d = await db.pool.query<{ meters: number }>(
      'SELECT ST_Distance(a.location, b.location) AS meters FROM drawers a, drawers b WHERE a.id = $1 AND b.id = $2',
      [a, b],
    );
    expect(d.rows[0]?.meters).toBeGreaterThan(1100);
    expect(d.rows[0]?.meters).toBeLessThan(1120);
  });

  it('D-13c drawer status and timezone are required; status constrained', async () => {
    await expectPgError(
      db.pool.query(
        `INSERT INTO drawers (name, address, timezone, location, status)
         VALUES ('d','a','Asia/Kolkata', ST_MakePoint(77,12)::geography, 'haunted')`,
      ),
      { code: CHECK_VIOLATION, constraint: 'drawers_status_check' },
    );
    await expectPgError(
      db.pool.query(
        `INSERT INTO drawers (name, address, location) VALUES ('d','a', ST_MakePoint(77,12)::geography)`,
      ),
      { code: '23502' },
    );
  });

  it('D-15 UPDATE bumps updated_at (trigger)', async () => {
    const id = (await f.user()).id;
    await db.pool.query(`SELECT pg_sleep(0.05)`);
    await db.pool.query(`UPDATE users SET display_name = 'Asha' WHERE id = $1`, [id]);
    const row = await db.pool.query<{ bumped: boolean }>(
      'SELECT updated_at > created_at AS bumped FROM users WHERE id = $1',
      [id],
    );
    expect(row.rows[0]?.bumped).toBe(true);
  });
});

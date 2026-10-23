import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Factories, createFactories, range, slot } from '../factories';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';

let db: TestDatabase;
let f: Factories;
beforeAll(async () => {
  db = await createTestDatabase();
  f = createFactories(db.db);
});
afterAll(async () => {
  await db.drop();
});

describe('factories', () => {
  it('D-17a every factory inserts a valid row with defaults (constraints are satisfied)', async () => {
    expect((await f.user()).status).toBe('active');
    expect((await f.category()).slug).toMatch(/^category-/);
    expect((await f.drawer()).timezone).toBe('Asia/Kolkata');
    expect((await f.itemModel()).slot_minutes).toBe(30);
    expect((await f.asset()).status).toBe('available');
    expect((await f.booking()).status).toBe('confirmed');
    expect((await f.occupancy()).kind).toBe('maintenance');
  });

  it('D-17b overrides win, and children reuse supplied parents', async () => {
    const drawer = await f.drawer({ name: 'Koramangala', status: 'temporarily_closed' });
    const model = await f.itemModel({ name: 'PS5', price_per_slot_paise: 9900 });
    const asset = await f.asset({
      drawer_id: drawer.id,
      item_model_id: model.id,
      asset_code: 'PS5-001',
    });

    expect(drawer).toMatchObject({ name: 'Koramangala', status: 'temporarily_closed' });
    expect(model).toMatchObject({ name: 'PS5', price_per_slot_paise: 9900 });
    expect(asset).toMatchObject({
      asset_code: 'PS5-001',
      drawer_id: drawer.id,
      item_model_id: model.id,
    });

    const booking = await f.booking({ asset_id: asset.id, status: 'cancelled' });
    expect(booking).toMatchObject({
      drawer_id: drawer.id,
      item_model_id: model.id,
      status: 'cancelled',
    });
  });

  it('D-17c a held booking gets a hold expiry; a booking occupancy gets its booking', async () => {
    const held = await f.booking({ status: 'held' });
    expect(held.hold_expires_at).not.toBeNull();

    const occupancy = await f.occupancy({ kind: 'booking' });
    expect(occupancy.booking_id).not.toBeNull();
  });

  it('D-17d drawers store longitude first', async () => {
    const drawer = await f.drawer({ lng: 72.8777, lat: 19.076 });
    const row = await db.pool.query<{ x: number; y: number }>(
      'SELECT ST_X(location::geometry) AS x, ST_Y(location::geometry) AS y FROM drawers WHERE id = $1',
      [drawer.id],
    );
    expect(row.rows[0]?.x).toBeCloseTo(72.8777, 6);
    expect(row.rows[0]?.y).toBeCloseTo(19.076, 6);
  });

  it('D-17e unique fields never collide across many calls or factory instances', async () => {
    const other = createFactories(db.db);
    const assets = [
      ...(await Promise.all(Array.from({ length: 5 }, () => f.asset()))),
      ...(await Promise.all(Array.from({ length: 5 }, () => other.asset()))),
    ];
    expect(new Set(assets.map((a) => a.asset_code)).size).toBe(10);
  });

  it('D-17f range helpers produce half-open literals', () => {
    expect(slot('10:00', '11:00')).toBe('[2030-01-01T10:00:00Z,2030-01-01T11:00:00Z)');
    expect(range(new Date('2030-02-01T00:00:00Z'), '2030-02-01T01:00:00Z')).toBe(
      '[2030-02-01T00:00:00.000Z,2030-02-01T01:00:00Z)',
    );
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Factories, createFactories, slot } from '../factories';
import { expectPgError } from '../support/db/pg-assert';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';

const EXCLUSION_VIOLATION = '23P01';
const CHECK_VIOLATION = '23514';
const UNIQUE_VIOLATION = '23505';

let db: TestDatabase;
let f: Factories;
let shared: { item_model_id: string; drawer_id: string };

const newAsset = async () => (await f.asset(shared)).id;
const occupy = (
  assetId: string,
  during: string,
  extra: { kind?: string; booking_id?: string | null; released_at?: string | null } = {},
) => f.occupancy({ asset_id: assetId, during, ...extra });

beforeAll(async () => {
  db = await createTestDatabase();
  f = createFactories(db.db);
  shared = { item_model_id: (await f.itemModel()).id, drawer_id: (await f.drawer()).id };
});
afterAll(async () => {
  await db.drop();
});

describe('no_overlapping_occupancy (README §9.3)', () => {
  it('D-03 rejects an overlapping range on the same asset with 23P01', async () => {
    const asset = await newAsset();
    await occupy(asset, slot('10:00', '11:00'));

    await expectPgError(occupy(asset, slot('10:30', '11:30')), {
      code: EXCLUSION_VIOLATION,
      constraint: 'no_overlapping_occupancy',
    });
  });

  it('D-03b rejects containment and identical ranges too', async () => {
    const asset = await newAsset();
    await occupy(asset, slot('10:00', '14:00'));

    for (const range of [slot('11:00', '12:00'), slot('10:00', '14:00'), slot('09:00', '15:00')]) {
      await expectPgError(occupy(asset, range), { code: EXCLUSION_VIOLATION });
    }
  });

  it('D-04 allows back-to-back (adjacent) ranges: [10,11) then [11,12)', async () => {
    const asset = await newAsset();
    await occupy(asset, slot('10:00', '11:00'));
    await occupy(asset, slot('11:00', '12:00'));
    await occupy(asset, slot('09:00', '10:00'));

    const rows = await db.pool.query('SELECT 1 FROM asset_occupancies WHERE asset_id = $1', [
      asset,
    ]);
    expect(rows.rowCount).toBe(3);
  });

  it('D-05 allows the same range on different assets', async () => {
    await occupy(await newAsset(), slot('10:00', '11:00'));
    await occupy(await newAsset(), slot('10:00', '11:00'));
  });

  it('D-06 a released row stops blocking but stays for history', async () => {
    const asset = await newAsset();
    const first = await occupy(asset, slot('10:00', '11:00'));
    await expectPgError(occupy(asset, slot('10:00', '10:45')), { code: EXCLUSION_VIOLATION });

    await db.pool.query('UPDATE asset_occupancies SET released_at = now() WHERE id = $1', [
      first.id,
    ]);
    await occupy(asset, slot('10:00', '10:45'));

    const rows = await db.pool.query(
      'SELECT released_at IS NULL AS live FROM asset_occupancies WHERE asset_id = $1 ORDER BY created_at',
      [asset],
    );
    expect(rows.rows).toEqual([{ live: false }, { live: true }]);
  });

  it('D-06b re-activating (un-releasing) over a live row is also rejected', async () => {
    const asset = await newAsset();
    const first = await occupy(asset, slot('10:00', '11:00'), {
      released_at: '2030-01-01T00:00:00Z',
    });
    await occupy(asset, slot('10:00', '11:00'));

    await expectPgError(
      db.pool.query('UPDATE asset_occupancies SET released_at = NULL WHERE id = $1', [first.id]),
      { code: EXCLUSION_VIOLATION, constraint: 'no_overlapping_occupancy' },
    );
  });

  it('D-14 is backed by a GiST index over (asset_id, during) restricted to live rows', async () => {
    const result = await db.pool.query<{ amname: string; indexdef: string }>(
      `SELECT am.amname, pg_get_indexdef(i.indexrelid) AS indexdef
         FROM pg_constraint c
         JOIN pg_index i ON i.indexrelid = c.conindid
         JOIN pg_class ic ON ic.oid = i.indexrelid
         JOIN pg_am am ON am.oid = ic.relam
        WHERE c.conname = 'no_overlapping_occupancy'`,
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.amname).toBe('gist');
    expect(result.rows[0]?.indexdef).toMatch(/\(asset_id, during\)/);
    expect(result.rows[0]?.indexdef).toMatch(/released_at IS NULL/);
  });
});

describe('range shape checks', () => {
  const bad: Array<[string, string, string]> = [
    ['D-07a empty', 'empty', 'occupancy_bounded'],
    ['D-07b unbounded lower', '(,2030-01-01T11:00:00Z)', 'occupancy_bounded'],
    ['D-07c unbounded upper', '[2030-01-01T10:00:00Z,)', 'occupancy_bounded'],
    ['D-07d exclusive lower', '(2030-01-01T10:00:00Z,2030-01-01T11:00:00Z)', 'occupancy_half_open'],
    ['D-07e inclusive upper', '[2030-01-01T10:00:00Z,2030-01-01T11:00:00Z]', 'occupancy_half_open'],
  ];

  it.each(bad)('%s is rejected', async (_label, range, constraint) => {
    await expectPgError(occupy(await newAsset(), range), { code: CHECK_VIOLATION, constraint });
  });
});

describe('booking link', () => {
  it('D-08 kind=booking requires booking_id, other kinds forbid it', async () => {
    const asset = await newAsset();
    const booking = await f.booking({ asset_id: asset });

    await expectPgError(
      occupy(asset, slot('10:00', '11:00'), { kind: 'booking', booking_id: null }),
      {
        code: CHECK_VIOLATION,
        constraint: 'occupancy_booking_link',
      },
    );
    await expectPgError(
      occupy(asset, slot('10:00', '11:00'), { kind: 'maintenance', booking_id: booking.id }),
      { code: CHECK_VIOLATION, constraint: 'occupancy_booking_link' },
    );

    await occupy(asset, slot('10:00', '11:00'), { kind: 'booking', booking_id: booking.id });
    await occupy(asset, slot('12:00', '13:00'), { kind: 'admin_block' });
  });

  it('D-08b rejects an unknown kind', async () => {
    await expectPgError(occupy(await newAsset(), slot('10:00', '11:00'), { kind: 'party' }), {
      code: CHECK_VIOLATION,
    });
  });

  it('D-09 a booking has at most one live occupancy; a released one may be replaced', async () => {
    const asset = await newAsset();
    const other = await newAsset();
    const booking = await f.booking({ asset_id: asset });

    const first = await occupy(asset, slot('10:00', '11:00'), {
      kind: 'booking',
      booking_id: booking.id,
    });
    await expectPgError(
      occupy(other, slot('10:00', '11:00'), { kind: 'booking', booking_id: booking.id }),
      { code: UNIQUE_VIOLATION, constraint: 'asset_occupancies_one_active_per_booking' },
    );

    await db.pool.query('UPDATE asset_occupancies SET released_at = now() WHERE id = $1', [
      first.id,
    ]);
    await occupy(other, slot('10:00', '11:00'), { kind: 'booking', booking_id: booking.id });
  });

  it('D-09b cannot delete a booking that still has occupancy rows (FK)', async () => {
    const asset = await newAsset();
    const booking = await f.booking({ asset_id: asset });
    await occupy(asset, slot('10:00', '11:00'), { kind: 'booking', booking_id: booking.id });

    await expectPgError(db.pool.query('DELETE FROM bookings WHERE id = $1', [booking.id]), {
      code: '23503',
    });
  });
});

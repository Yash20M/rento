import { afterAll, beforeAll, describe, it } from 'vitest';
import { type Factories, createFactories } from '../factories';
import { expectPgError } from '../support/db/pg-assert';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';

const CHECK_VIOLATION = '23514';
const UNIQUE_VIOLATION = '23505';
const EXCLUSION_VIOLATION = '23P01';

let db: TestDatabase;
let f: Factories;
let drawerId: string;
beforeAll(async () => {
  db = await createTestDatabase();
  f = createFactories(db.db);
  drawerId = (await f.drawer()).id;
});
afterAll(async () => {
  await db.drop();
});

const hours = (weekday: number, opens: string, closes: string, drawer = drawerId) =>
  db.pool.query(
    'INSERT INTO drawer_hours (drawer_id, weekday, opens_at, closes_at) VALUES ($1, $2, $3, $4)',
    [drawer, weekday, opens, closes],
  );
const closure = (range: string, drawer = drawerId) =>
  db.pool.query('INSERT INTO drawer_closures (drawer_id, during) VALUES ($1, $2::tstzrange)', [
    drawer,
    range,
  ]);

describe('drawer_hours', () => {
  it('H-1 one window per weekday', async () => {
    await hours(1, '09:00', '17:00');
    await expectPgError(hours(1, '10:00', '12:00'), {
      code: UNIQUE_VIOLATION,
      constraint: 'drawer_hours_pkey',
    });
  });

  it('H-2 opening must be before closing (no overnight windows) and the weekday is 1–7', async () => {
    await expectPgError(hours(2, '18:00', '09:00'), {
      code: CHECK_VIOLATION,
      constraint: 'drawer_hours_opens_before_closes',
    });
    await expectPgError(hours(2, '09:00', '09:00'), {
      code: CHECK_VIOLATION,
      constraint: 'drawer_hours_opens_before_closes',
    });
    await expectPgError(hours(0, '09:00', '10:00'), { code: CHECK_VIOLATION });
    await expectPgError(hours(8, '09:00', '10:00'), { code: CHECK_VIOLATION });
  });

  it('H-3 hours disappear with their drawer', async () => {
    const other = (await f.drawer()).id;
    await hours(3, '09:00', '10:00', other);
    await db.pool.query('DELETE FROM drawers WHERE id = $1', [other]);
    const left = await db.pool.query('SELECT 1 FROM drawer_hours WHERE drawer_id = $1', [other]);
    if (left.rowCount !== 0) throw new Error('hours were not removed with the drawer');
  });
});

describe('drawer_closures', () => {
  it('H-4 two closures of one drawer can never overlap; adjacent ones are fine; other drawers are independent', async () => {
    await closure('[2030-03-01 00:00+00, 2030-03-03 00:00+00)');
    await expectPgError(closure('[2030-03-02 00:00+00, 2030-03-04 00:00+00)'), {
      code: EXCLUSION_VIOLATION,
      constraint: 'drawer_closures_no_overlap',
    });
    await closure('[2030-03-03 00:00+00, 2030-03-04 00:00+00)'); // half-open: touching is not overlapping
    await closure('[2030-03-01 00:00+00, 2030-03-03 00:00+00)', (await f.drawer()).id);
  });

  it('H-5 closures must be finite and non-empty', async () => {
    await expectPgError(closure('[2030-05-01 00:00+00, 2030-05-01 00:00+00)'), {
      code: CHECK_VIOLATION,
      constraint: 'drawer_closures_finite',
    });
    await expectPgError(closure('[2030-05-01 00:00+00,)'), {
      code: CHECK_VIOLATION,
      constraint: 'drawer_closures_finite',
    });
    await expectPgError(closure('(,2030-05-01 00:00+00)'), {
      code: CHECK_VIOLATION,
      constraint: 'drawer_closures_finite',
    });
  });
});

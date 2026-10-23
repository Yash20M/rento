import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { RetryLaterError, SlotTakenError, UniqueViolationError } from '../../src/db/errors';
import { withTransaction } from '../../src/db/transaction';
import { type Factories, createFactories, slot } from '../factories';
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

/** A promise plus the function that resolves it — lets a test hold a transaction open deterministically. */
function gate() {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
}

/** Waits until some backend is blocked on a lock (no sleeping — polls the server's own view). */
async function waitUntilSomeoneIsBlocked(): Promise<void> {
  await vi.waitFor(async () => {
    const res = await db.pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'`,
    );
    expect(res.rows[0]?.n).toBeGreaterThan(0);
  });
}

describe('real PostgreSQL failures become domain errors', () => {
  it('D-08 a lost race for a slot (23P01) becomes SlotTakenError', async () => {
    const asset = await f.asset();
    const insertOverlapping =
      (from: string, to: string) => (trx: Parameters<Parameters<typeof withTransaction>[1]>[0]) =>
        trx
          .insertInto('asset_occupancies')
          .values({
            asset_id: asset.id,
            kind: 'maintenance',
            during: sql`${slot(from, to)}::tstzrange`,
          })
          .execute();

    const aInserted = gate();
    const aMayCommit = gate();
    const a = withTransaction(db.db, async (trx) => {
      await insertOverlapping('10:00', '11:00')(trx);
      aInserted.open();
      await aMayCommit.promise;
    });
    await aInserted.promise;

    // B blocks on A's uncommitted index entry (README §9.3) and fails once A commits.
    const b = withTransaction(db.db, insertOverlapping('10:30', '11:30'));
    const bOutcome = b.then(
      () => 'inserted',
      (error: unknown) => error,
    );
    await waitUntilSomeoneIsBlocked();
    aMayCommit.open();
    await a;

    const error = await bOutcome;
    expect(error).toBeInstanceOf(SlotTakenError);
    expect(error).toMatchObject({ status: 409, code: 'BOOKING_SLOT_TAKEN' });

    const rows = await db.pool.query('SELECT 1 FROM asset_occupancies WHERE asset_id = $1', [
      asset.id,
    ]);
    expect(rows.rowCount).toBe(1);
  });

  it('D-08b if the first transaction rolls back, the waiting one succeeds', async () => {
    const asset = await f.asset();
    const insert = (trx: Parameters<Parameters<typeof withTransaction>[1]>[0]) =>
      trx
        .insertInto('asset_occupancies')
        .values({
          asset_id: asset.id,
          kind: 'maintenance',
          during: sql`${slot('10:00', '11:00')}::tstzrange`,
        })
        .execute();

    const aInserted = gate();
    const aMayFinish = gate();
    const a = withTransaction(db.db, async (trx) => {
      await insert(trx);
      aInserted.open();
      await aMayFinish.promise;
      throw new Error('payment init failed');
    });
    const aOutcome = a.catch((error: unknown) => error);
    await aInserted.promise;

    const b = withTransaction(db.db, insert);
    await waitUntilSomeoneIsBlocked();
    aMayFinish.open();

    expect(await aOutcome).toBeInstanceOf(Error);
    await expect(b).resolves.toBeDefined();
  });

  it('D-09 a duplicate asset_code (23505) becomes UniqueViolationError with the constraint', async () => {
    const existing = await f.asset();
    const error = await withTransaction(db.db, (trx) =>
      trx
        .insertInto('assets')
        .values({
          asset_code: existing.asset_code,
          item_model_id: existing.item_model_id,
          drawer_id: existing.drawer_id,
        })
        .execute(),
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UniqueViolationError);
    expect(error).toMatchObject({ constraint: 'assets_asset_code_key', table: 'assets' });
  });

  it('D-10 a lock wait beyond lockTimeoutMs (55P03) becomes RetryLaterError; the holder is unaffected', async () => {
    const asset = await f.asset();
    const lockRow = (trx: Parameters<Parameters<typeof withTransaction>[1]>[0]) =>
      trx.selectFrom('assets').selectAll().where('id', '=', asset.id).forUpdate().execute();

    const aLocked = gate();
    const aMayCommit = gate();
    const a = withTransaction(db.db, async (trx) => {
      await lockRow(trx);
      aLocked.open();
      await aMayCommit.promise;
      return 'a-committed';
    });
    await aLocked.promise;

    const error = await withTransaction(db.db, lockRow, { lockTimeoutMs: 200 }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(RetryLaterError);
    expect(error).toMatchObject({ status: 503, code: 'RETRY_LATER' });

    aMayCommit.open();
    await expect(a).resolves.toBe('a-committed');
  });

  it('D-11 a statement running past statement_timeout (57014) becomes RetryLaterError', async () => {
    const error = await withTransaction(db.db, async (trx) => {
      await sql`select set_config('statement_timeout', '50ms', true)`.execute(trx);
      await sql`select pg_sleep(5)`.execute(trx);
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RetryLaterError);
  });

  it('D-11b an unmapped database error (FK 23503) keeps its identity and code', async () => {
    const error = await withTransaction(db.db, (trx) =>
      trx
        .insertInto('assets')
        .values({
          asset_code: 'ORPHAN-1',
          item_model_id: '00000000-0000-0000-0000-000000000000',
          drawer_id: '00000000-0000-0000-0000-000000000000',
        })
        .execute(),
    ).catch((e: unknown) => e);

    expect(error).toMatchObject({ code: '23503' });
    expect(error).not.toBeInstanceOf(RetryLaterError);
  });
});

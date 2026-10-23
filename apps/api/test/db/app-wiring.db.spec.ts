import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CLOCK, SystemClock } from '../../src/common/clock/clock';
import { PG_POOL } from '../../src/db/tokens';
import { TransactionManager } from '../../src/db/transaction';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';

let database: TestDatabase;
let current: TestApp;
beforeAll(async () => {
  database = await createTestDatabase();
  current = await createTestApp({ config: testConfig({ DATABASE_URL: database.url }) });
});
afterAll(async () => {
  await current.app.close().catch(() => undefined);
  await database.drop();
});

describe('Nest wiring against a real database', () => {
  it('A-02 GET /readyz → 200 database up through the shared Kysely pool', async () => {
    const res = await current.app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ready', checks: { database: 'up' } });
  });

  it('A-01 the CLOCK token resolves to the system clock', () => {
    expect(current.app.get(CLOCK)).toBeInstanceOf(SystemClock);
  });

  it('A-03 TransactionManager is injectable and talks to the database', async () => {
    const manager = current.app.get(TransactionManager);
    const rows = await manager.run(async (trx) => {
      const res = await trx.selectFrom('users').select('id').execute();
      return res.length;
    });
    expect(rows).toBe(0);
  });

  it('A-04 closing the app ends the shared pool exactly once', async () => {
    const pool = current.app.get<Pool>(PG_POOL);
    expect(pool.ended).toBe(false);
    await current.app.close();
    expect(pool.ended).toBe(true);
  });
});

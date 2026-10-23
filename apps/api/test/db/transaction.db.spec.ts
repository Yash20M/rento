import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TransactionManager, withTransaction } from '../../src/db/transaction';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';

let db: TestDatabase;
beforeAll(async () => {
  db = await createTestDatabase();
});
afterAll(async () => {
  await db.drop();
});

const countUsers = async (email: string): Promise<number> => {
  // Deliberately a different pooled connection than the transaction under test.
  const result = await db.pool.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM users WHERE email = $1',
    [email],
  );
  return result.rows[0]?.n ?? 0;
};

describe('withTransaction', () => {
  it('D-01 commits when the callback resolves', async () => {
    const result = await withTransaction(db.db, async (trx) => {
      await trx.insertInto('users').values({ email: 'commit@example.com' }).execute();
      return 'done';
    });
    expect(result).toBe('done');
    expect(await countUsers('commit@example.com')).toBe(1);
  });

  it('D-02 rolls back and rethrows the original error when the callback throws', async () => {
    const boom = new Error('boom');
    await expect(
      withTransaction(db.db, async (trx) => {
        await trx.insertInto('users').values({ email: 'rollback@example.com' }).execute();
        throw boom;
      }),
    ).rejects.toBe(boom);
    expect(await countUsers('rollback@example.com')).toBe(0);
  });

  it('D-03 applies lock_timeout locally: default 3 s, overridable', async () => {
    const show = (options?: { lockTimeoutMs: number }) =>
      withTransaction(
        db.db,
        async (trx) => {
          const res = await sql<{ lock_timeout: string }>`show lock_timeout`.execute(trx);
          return res.rows[0]?.lock_timeout;
        },
        options,
      );

    expect(await show()).toBe('3s');
    expect(await show({ lockTimeoutMs: 1500 })).toBe('1500ms');
  });

  it('D-04 runs at READ COMMITTED (no SERIALIZABLE retry storms)', async () => {
    const level = await withTransaction(db.db, async (trx) => {
      const res = await sql<{ transaction_isolation: string }>`show transaction_isolation`.execute(
        trx,
      );
      return res.rows[0]?.transaction_isolation;
    });
    expect(level).toBe('read committed');
  });

  it('D-05 lock_timeout does not leak to later work on the pool (transaction-local)', async () => {
    await withTransaction(db.db, async () => undefined, { lockTimeoutMs: 1234 });
    for (let i = 0; i < 5; i += 1) {
      const res = await db.pool.query<{ lock_timeout: string }>('show lock_timeout');
      expect(res.rows[0]?.lock_timeout).toBe('0');
    }
  });

  it('D-06 TransactionManager.run behaves the same (commit and rollback)', async () => {
    const manager = new TransactionManager(db.db);
    await manager.run((trx) =>
      trx.insertInto('users').values({ email: 'manager-ok@example.com' }).execute(),
    );
    expect(await countUsers('manager-ok@example.com')).toBe(1);

    await expect(
      manager.run(async (trx) => {
        await trx.insertInto('users').values({ email: 'manager-bad@example.com' }).execute();
        throw new Error('nope');
      }),
    ).rejects.toThrow('nope');
    expect(await countUsers('manager-bad@example.com')).toBe(0);
  });

  it('D-07 writes are invisible to other connections until commit', async () => {
    let seenByOthersDuringTx = -1;
    let seenByTxItself = -1;
    await withTransaction(db.db, async (trx) => {
      await trx.insertInto('users').values({ email: 'visibility@example.com' }).execute();
      seenByOthersDuringTx = await countUsers('visibility@example.com');
      const own = await trx
        .selectFrom('users')
        .select(sql<number>`count(*)::int`.as('n'))
        .where('email', '=', 'visibility@example.com')
        .executeTakeFirstOrThrow();
      seenByTxItself = own.n;
    });
    expect(seenByOthersDuringTx).toBe(0);
    expect(seenByTxItself).toBe(1);
    expect(await countUsers('visibility@example.com')).toBe(1);
  });
});

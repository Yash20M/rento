import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditLog } from '../../src/modules/reporting-audit';
import { type Factories, createFactories } from '../factories';
import { expectPgError } from '../support/db/pg-assert';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeClock } from '../support/fake-clock';

const CHECK_VIOLATION = '23514';
const INTEGRITY = '23000';

let db: TestDatabase;
let f: Factories;
const clock = new FakeClock('2030-01-01T00:00:00Z');
const audit = new AuditLog(clock);
beforeAll(async () => {
  db = await createTestDatabase();
  f = createFactories(db.db);
});
afterAll(async () => {
  await db.drop();
});

const rows = async () => (await db.pool.query('SELECT * FROM audit_logs ORDER BY at, id')).rows;

describe('audit_logs', () => {
  it('L-1 records actor, action, entity, before/after, reason and ip with the injected clock', async () => {
    const actor = await f.user();
    await audit.record(db.db, {
      actor: { id: actor.id, ip: '203.0.113.9' },
      action: 'role.updated',
      entityType: 'role',
      entityId: 'abc',
      before: { name: 'Old' },
      after: { name: 'New', password: 'hunter2' },
      reason: 'rename',
    });
    const [row] = await rows();
    expect(row).toMatchObject({
      actor_id: actor.id,
      action: 'role.updated',
      entity_type: 'role',
      entity_id: 'abc',
      before: { name: 'Old' },
      reason: 'rename',
      ip: '203.0.113.9',
      at: new Date('2030-01-01T00:00:00Z'),
    });
    expect(row.after).toEqual({ name: 'New', password: '[redacted]' }); // secrets never reach the table
  });

  it('L-2 the actor may be null (the operator CLI / the system), the details optional', async () => {
    await audit.record(db.db, {
      actor: { id: null },
      action: 'super_admin.bootstrapped',
      entityType: 'user',
    });
    const row = (await rows()).find((r) => r.action === 'super_admin.bootstrapped');
    expect(row).toMatchObject({
      actor_id: null,
      entity_id: null,
      before: null,
      after: null,
      reason: null,
    });
  });

  it.each(['NoDots', 'UPPER.case', 'a.b.c', '.x', 'x.', 'a b.c', ''])(
    'L-3 the action %j is rejected',
    async (action) => {
      await expectPgError(
        db.pool.query(`INSERT INTO audit_logs (action, entity_type) VALUES ($1, 'x')`, [action]),
        { code: CHECK_VIOLATION, constraint: 'audit_logs_action_format' },
      );
    },
  );

  it('L-4 rows can never be changed, deleted or truncated — by anyone', async () => {
    const [row] = await rows();
    await expectPgError(
      db.pool.query(`UPDATE audit_logs SET action = 'x.y' WHERE id = $1`, [row.id]),
      {
        code: INTEGRITY,
      },
    );
    await expectPgError(db.pool.query(`UPDATE audit_logs SET reason = 'edited'`), {
      code: INTEGRITY,
    });
    await expectPgError(db.pool.query('DELETE FROM audit_logs WHERE id = $1', [row.id]), {
      code: INTEGRITY,
    });
    await expectPgError(db.pool.query('DELETE FROM audit_logs'), { code: INTEGRITY });
    await expectPgError(db.pool.query('TRUNCATE audit_logs'), { code: INTEGRITY });
    expect((await rows()).length).toBeGreaterThan(0);
  });

  it('L-5 an audit row written inside a rolled-back transaction disappears with it', async () => {
    const before = (await rows()).length;
    await expect(
      db.db.transaction().execute(async (trx) => {
        await audit.record(trx, {
          actor: { id: null },
          action: 'role.created',
          entityType: 'role',
        });
        throw new Error('the change failed after auditing');
      }),
    ).rejects.toThrow('failed after');
    expect((await rows()).length).toBe(before);
  });
});

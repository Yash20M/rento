import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PermissionRepository } from '../../src/modules/access-control/data/permission.repository';
import { PERMISSIONS, diffCatalog } from '../../src/modules/access-control/domain/permissions';
import { expectPgError } from '../support/db/pg-assert';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';

const CHECK_VIOLATION = '23514';
const UNIQUE_VIOLATION = '23505';

let db: TestDatabase;
const repository = new PermissionRepository();

beforeAll(async () => {
  db = await createTestDatabase();
});
afterAll(async () => {
  await db.drop();
});

const insert = (key: string, group = 'Test', description = 'A test permission') =>
  db.pool.query('INSERT INTO permissions (key, group_name, description) VALUES ($1, $2, $3)', [
    key,
    group,
    description,
  ]);

describe('permissions table', () => {
  it('D-1 the migrated table and the code catalog are identical, in both directions', async () => {
    const keys = await repository.listKeys(db.db);
    expect(diffCatalog(keys)).toEqual({ missingInDatabase: [], unknownToCode: [] });
    expect(keys).toHaveLength(PERMISSIONS.length);
  });

  it('D-2 group and description match the code, not just the key', async () => {
    const rows = await db.pool.query(
      'SELECT key, group_name, description FROM permissions ORDER BY key',
    );
    const expected = [...PERMISSIONS]
      .map((p) => ({ key: p.key, group_name: p.group, description: p.description }))
      .sort((a, b) => a.key.localeCompare(b.key, 'en'));
    expect(rows.rows).toEqual(expected);
  });

  it.each(['Bad:Key', 'nocolon', 'a:b:c', 'a:', ':b', '', 'a:1', 'a b:c', 'a-b:c'])(
    'D-3 the CHECK rejects the malformed key %j',
    async (key) => {
      await expectPgError(insert(key), {
        code: CHECK_VIOLATION,
        constraint: 'permissions_key_format',
      });
    },
  );

  it('D-4 a key is unique', async () => {
    await expectPgError(insert('bookings:read'), {
      code: UNIQUE_VIOLATION,
      constraint: 'permissions_pkey',
    });
  });

  it('D-5 blank group or description is rejected', async () => {
    await expectPgError(insert('ok:one', '  ', 'fine'), {
      code: CHECK_VIOLATION,
      constraint: 'permissions_group_not_blank',
    });
    await expectPgError(insert('ok:two', 'Group', ''), {
      code: CHECK_VIOLATION,
      constraint: 'permissions_description_not_blank',
    });
  });

  it('D-6 drift in either direction is detected', async () => {
    await db.pool.query(`DELETE FROM permissions WHERE key = 'audit:read'`);
    await insert('rogue:thing');
    const diff = diffCatalog(await repository.listKeys(db.db));
    expect(diff).toEqual({ missingInDatabase: ['audit:read'], unknownToCode: ['rogue:thing'] });
  });
});

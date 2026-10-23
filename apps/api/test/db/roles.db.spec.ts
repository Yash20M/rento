import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Factories, createFactories } from '../factories';
import { expectPgError } from '../support/db/pg-assert';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';

const CHECK_VIOLATION = '23514';
const UNIQUE_VIOLATION = '23505';
const FK_VIOLATION = '23503';
const INTEGRITY = '23000';

let db: TestDatabase;
let f: Factories;
let counter = 0;
beforeAll(async () => {
  db = await createTestDatabase();
  f = createFactories(db.db);
});
afterAll(async () => {
  await db.drop();
});

const roleName = () => `Role ${(counter += 1)}-${Date.now()}`;
const addRole = async (name = roleName()) =>
  (await db.pool.query<{ id: string }>('INSERT INTO roles (name) VALUES ($1) RETURNING id', [name]))
    .rows[0]!.id;
const superAdminId = async () =>
  (await db.pool.query<{ id: string }>('SELECT id FROM roles WHERE is_super_admin')).rows[0]!.id;

describe('roles', () => {
  it('D-1 the migration seeds exactly one locked Super Admin role', async () => {
    const rows = await db.pool.query(
      'SELECT name, is_system, is_super_admin FROM roles WHERE is_system OR is_super_admin',
    );
    expect(rows.rows).toEqual([{ name: 'Super Admin', is_system: true, is_super_admin: true }]);
  });

  it('D-2 a second super-admin role is impossible', async () => {
    await expectPgError(
      db.pool.query(
        `INSERT INTO roles (name, is_system, is_super_admin) VALUES ('Another', true, true)`,
      ),
      { code: UNIQUE_VIOLATION, constraint: 'roles_single_super_admin' },
    );
  });

  it('D-3 a super-admin role must be a system role', async () => {
    await expectPgError(
      db.pool.query(
        `INSERT INTO roles (name, is_system, is_super_admin) VALUES ('X', false, true)`,
      ),
      { code: CHECK_VIOLATION, constraint: 'roles_super_admin_is_system' },
    );
  });

  it('D-4 names are unique ignoring case', async () => {
    const name = roleName();
    await addRole(name);
    await expectPgError(
      db.pool.query('INSERT INTO roles (name) VALUES ($1)', [name.toUpperCase()]),
      { code: UNIQUE_VIOLATION, constraint: 'roles_name_lower_key' },
    );
  });

  it.each(['', ' padded ', 'x'.repeat(101)])('D-5 the name %j is rejected', async (name) => {
    await expectPgError(db.pool.query('INSERT INTO roles (name) VALUES ($1)', [name]), {
      code: CHECK_VIOLATION,
      constraint: 'roles_name_format',
    });
  });

  it('D-6 an overlong description is rejected', async () => {
    await expectPgError(
      db.pool.query('INSERT INTO roles (name, description) VALUES ($1, $2)', [
        roleName(),
        'd'.repeat(501),
      ]),
      { code: CHECK_VIOLATION, constraint: 'roles_description_length' },
    );
  });

  it('D-7 system roles cannot be updated or deleted, whatever the application does', async () => {
    const id = await superAdminId();
    await expectPgError(db.pool.query(`UPDATE roles SET name = 'Hacked' WHERE id = $1`, [id]), {
      code: INTEGRITY,
    });
    await expectPgError(db.pool.query(`UPDATE roles SET is_system = false WHERE id = $1`, [id]), {
      code: INTEGRITY,
    });
    await expectPgError(db.pool.query('DELETE FROM roles WHERE id = $1', [id]), {
      code: INTEGRITY,
    });
    expect(await superAdminId()).toBe(id);
  });

  it('D-8 ordinary roles can be updated and deleted', async () => {
    const id = await addRole();
    await db.pool.query(
      `UPDATE roles SET description = 'edited', updated_at = now() WHERE id = $1`,
      [id],
    );
    await db.pool.query('DELETE FROM roles WHERE id = $1', [id]);
    expect((await db.pool.query('SELECT 1 FROM roles WHERE id = $1', [id])).rowCount).toBe(0);
  });
});

describe('role_permissions', () => {
  it('D-9 only catalog permissions can be granted, once per role', async () => {
    const id = await addRole();
    await db.pool.query(
      `INSERT INTO role_permissions (role_id, permission_key) VALUES ($1, 'bookings:read')`,
      [id],
    );
    await expectPgError(
      db.pool.query(
        `INSERT INTO role_permissions (role_id, permission_key) VALUES ($1, 'bookings:read')`,
        [id],
      ),
      { code: UNIQUE_VIOLATION, constraint: 'role_permissions_pkey' },
    );
    await expectPgError(
      db.pool.query(
        `INSERT INTO role_permissions (role_id, permission_key) VALUES ($1, 'made:up')`,
        [id],
      ),
      { code: FK_VIOLATION },
    );
  });

  it('D-10 the Super Admin role cannot be given explicit permissions', async () => {
    await expectPgError(
      db.pool.query(
        `INSERT INTO role_permissions (role_id, permission_key) VALUES ($1, 'bookings:read')`,
        [await superAdminId()],
      ),
      { code: INTEGRITY },
    );
  });

  it('D-11 deleting a role removes its permission rows', async () => {
    const id = await addRole();
    await db.pool.query(
      `INSERT INTO role_permissions (role_id, permission_key) VALUES ($1, 'bookings:read'), ($1, 'users:read')`,
      [id],
    );
    await db.pool.query('DELETE FROM roles WHERE id = $1', [id]);
    const left = await db.pool.query('SELECT 1 FROM role_permissions WHERE role_id = $1', [id]);
    expect(left.rowCount).toBe(0);
  });
});

describe('user_roles', () => {
  it('D-12 an assigned role cannot be deleted (RESTRICT)', async () => {
    const roleId = await addRole();
    const user = await f.user();
    await db.pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [
      user.id,
      roleId,
    ]);
    await expectPgError(db.pool.query('DELETE FROM roles WHERE id = $1', [roleId]), {
      code: FK_VIOLATION,
    });
    await db.pool.query('DELETE FROM user_roles WHERE role_id = $1', [roleId]);
    await db.pool.query('DELETE FROM roles WHERE id = $1', [roleId]);
  });

  it('D-13 the same user cannot hold the same role in the same scope twice', async () => {
    const roleId = await addRole();
    const user = await f.user();
    await db.pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [
      user.id,
      roleId,
    ]);
    await expectPgError(
      db.pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [user.id, roleId]),
      { code: UNIQUE_VIOLATION, constraint: 'user_roles_user_role_scope_key' },
    );
  });
});

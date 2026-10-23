import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PERMISSIONS } from '../../src/modules/access-control/domain/permissions';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { grantPermissions, makeSuperAdmin } from '../support/access';

const PASSWORD = 'correct horse battery staple';

interface Session {
  accessToken: string;
  user: { id: string };
}
interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isSuperAdmin: boolean;
  permissions: string[];
  assignedCount: number;
  createdAt: string;
  updatedAt: string;
}
interface Problem {
  code: string;
  errors?: Array<{ field: string; message: string }>;
}

let database: TestDatabase;
let current: TestApp;
let counter = 0;

let reader: Session;
let manager: Session;
let superAdmin: Session;
let nobody: Session;

beforeAll(async () => {
  database = await createTestDatabase();
  current = await createTestApp({ config: testConfig({ DATABASE_URL: database.url }) });

  reader = await user();
  manager = await user();
  superAdmin = await user();
  nobody = await user();
  // Real role assignments, resolved from the database on every request.
  await grantPermissions(database.pool, reader.user.id, ['roles:read']);
  await grantPermissions(database.pool, manager.user.id, ['roles:manage']); // manage alone does not read
  await makeSuperAdmin(database.pool, superAdmin.user.id);
});
afterAll(async () => {
  await current.app.close();
  await database.drop();
});

async function user(): Promise<Session> {
  const res = await current.app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: {
      email: `adm-${(counter += 1)}-${Date.now()}@example.com`,
      password: PASSWORD,
      name: 'Admin',
    },
  });
  return res.json<Session>();
}
const uniqueName = (tag = 'Role') => `${tag} ${(counter += 1)}-${Date.now()}`;
const call = (
  who: Session | undefined,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  payload?: Record<string, unknown>,
  app: TestApp = current,
) =>
  app.app.inject({
    method,
    url,
    ...(who && { headers: { authorization: `Bearer ${who.accessToken}` } }),
    ...(payload !== undefined && { payload }),
  });
const create = async (overrides: Record<string, unknown> = {}) => {
  const res = await call(superAdmin, 'POST', '/v1/admin/roles', {
    name: uniqueName(),
    permissions: ['bookings:read'],
    ...overrides,
  });
  return res;
};
const makeRole = async (overrides: Record<string, unknown> = {}) =>
  (await create(overrides)).json<Role>();
const superAdminRole = async () =>
  (await call(superAdmin, 'GET', '/v1/admin/roles')).json<Role[]>().find((r) => r.isSuperAdmin)!;

describe('authorization matrix (deny by default)', () => {
  const routes: Array<
    [string, 'GET' | 'POST' | 'PATCH' | 'DELETE', string, 'roles:read' | 'roles:manage']
  > = [
    ['list', 'GET', '/v1/admin/roles', 'roles:read'],
    ['get', 'GET', '/v1/admin/roles/00000000-0000-4000-8000-000000000000', 'roles:read'],
    ['permissions', 'GET', '/v1/admin/permissions', 'roles:read'],
    ['create', 'POST', '/v1/admin/roles', 'roles:manage'],
    ['update', 'PATCH', '/v1/admin/roles/00000000-0000-4000-8000-000000000000', 'roles:manage'],
    ['delete', 'DELETE', '/v1/admin/roles/00000000-0000-4000-8000-000000000000', 'roles:manage'],
  ];

  it.each(routes)('A-1 %s: no token ⇒ 401', async (_name, method, url) => {
    const res = await call(undefined, method, url, method === 'POST' ? { name: 'x' } : undefined);
    expect(res.statusCode).toBe(401);
  });

  it.each(routes)(
    'A-2 %s: a user without the permission ⇒ 403 PERMISSION_DENIED',
    async (_n, method, url) => {
      const res = await call(nobody, method, url, method === 'POST' ? { name: 'x' } : undefined);
      expect(res.statusCode).toBe(403);
      expect(res.json<Problem>().code).toBe('PERMISSION_DENIED');
    },
  );

  it.each(routes)(
    'A-3 %s: with ONLY the other permission ⇒ 403 (read ≠ manage)',
    async (_n, method, url, needs) => {
      const wrong = needs === 'roles:read' ? manager : reader;
      const res = await call(wrong, method, url, method === 'POST' ? { name: 'x' } : undefined);
      expect(res.statusCode).toBe(403);
    },
  );

  it('A-4 the right permission opens read routes; Super Admin opens all', async () => {
    const role = await makeRole();
    expect((await call(reader, 'GET', '/v1/admin/roles')).statusCode).toBe(200);
    expect((await call(reader, 'GET', `/v1/admin/roles/${role.id}`)).statusCode).toBe(200);
    expect((await call(reader, 'GET', '/v1/admin/permissions')).statusCode).toBe(200);
    expect(
      (await call(superAdmin, 'PATCH', `/v1/admin/roles/${role.id}`, { description: 'by boss' }))
        .statusCode,
    ).toBe(200);
    expect((await call(superAdmin, 'DELETE', `/v1/admin/roles/${role.id}`)).statusCode).toBe(204);
  });

  it('A-5 INTERIM: holding roles:manage is not enough to change roles — only a Super Admin may (403 ROLE_ESCALATION)', async () => {
    const role = await makeRole();
    for (const res of [
      await call(manager, 'POST', '/v1/admin/roles', { name: uniqueName() }),
      await call(manager, 'PATCH', `/v1/admin/roles/${role.id}`, { permissions: ['audit:read'] }),
      await call(manager, 'DELETE', `/v1/admin/roles/${role.id}`),
    ]) {
      expect(res.statusCode).toBe(403);
      expect(res.json<Problem>().code).toBe('ROLE_ESCALATION');
    }
    expect(
      (await call(superAdmin, 'GET', `/v1/admin/roles/${role.id}`)).json<Role>().permissions,
    ).toEqual(['bookings:read']);
  });

  it('A-6 a user with no role at all is denied everywhere, and removing a role takes effect on the very next request', async () => {
    const temp = await user();
    expect((await call(temp, 'GET', '/v1/admin/roles')).statusCode).toBe(403);
    await grantPermissions(database.pool, temp.user.id, ['roles:read']);
    expect((await call(temp, 'GET', '/v1/admin/roles')).statusCode).toBe(200);
    await database.pool.query('DELETE FROM user_roles WHERE user_id = $1', [temp.user.id]);
    expect((await call(temp, 'GET', '/v1/admin/roles')).statusCode).toBe(403);
  });

  it('A-7 a suspended Super Admin has no access', async () => {
    const temp = await user();
    await makeSuperAdmin(database.pool, temp.user.id);
    expect((await call(temp, 'GET', '/v1/admin/roles')).statusCode).toBe(200);
    await database.pool.query("UPDATE users SET status = 'suspended' WHERE id = $1", [
      temp.user.id,
    ]);
    expect((await call(temp, 'GET', '/v1/admin/roles')).statusCode).toBe(403);
  });
});

describe('role CRUD', () => {
  it('R-1 creates a role, with sorted de-duplicated permissions, and reads it back', async () => {
    const name = uniqueName('Support Agent');
    const res = await create({
      name: `  ${name}  `,
      description: ' Handles tickets ',
      permissions: ['users:read', 'bookings:read', 'users:read'],
    });
    expect(res.statusCode).toBe(201);
    const role = res.json<Role>();
    expect(role).toMatchObject({
      name,
      description: 'Handles tickets',
      isSystem: false,
      isSuperAdmin: false,
      permissions: ['bookings:read', 'users:read'],
      assignedCount: 0,
    });

    const read = await call(reader, 'GET', `/v1/admin/roles/${role.id}`);
    expect(read.json<Role>()).toEqual(role);
  });

  it('R-2 a role may have no permissions and no description', async () => {
    const role = await makeRole({ permissions: undefined, description: undefined });
    expect(role).toMatchObject({ permissions: [], description: null });
  });

  it('R-3 the list contains the Super Admin (locked, flagged, no explicit permissions) and new roles', async () => {
    const role = await makeRole();
    const list = (await call(reader, 'GET', '/v1/admin/roles')).json<Role[]>();
    const sa = list.find((r) => r.isSuperAdmin);
    expect(sa).toMatchObject({ name: 'Super Admin', isSystem: true, permissions: [] });
    expect(list.find((r) => r.id === role.id)).toBeDefined();
    expect(list[0]?.isSystem).toBe(true); // system roles first
  });

  it('R-4 role names are unique ignoring case, on create and rename', async () => {
    const first = await makeRole({ name: uniqueName('Unique') });
    const dup = await create({ name: first.name.toUpperCase() });
    expect(dup.statusCode).toBe(422);
    expect(dup.json<Problem>().errors?.map((e) => e.field)).toEqual(['name']);

    const other = await makeRole();
    const rename = await call(superAdmin, 'PATCH', `/v1/admin/roles/${other.id}`, {
      name: first.name.toLowerCase(),
    });
    expect(rename.statusCode).toBe(422);
    // renaming to its own name (different case) is fine
    const same = await call(superAdmin, 'PATCH', `/v1/admin/roles/${first.id}`, {
      name: first.name.toUpperCase(),
    });
    expect(same.statusCode).toBe(200);
  });

  it('R-5 unknown permission keys are 422 on "permissions" and nothing is created', async () => {
    const name = uniqueName('Bogus');
    const res = await create({ name, permissions: ['bookings:read', 'bookings:fly', 'made:up'] });
    expect(res.statusCode).toBe(422);
    const problem = res.json<Problem>();
    expect(problem.errors?.[0]?.field).toBe('permissions');
    expect(problem.errors?.[0]?.message).toContain('bookings:fly');
    expect(problem.errors?.[0]?.message).toContain('made:up');
    const exists = await database.pool.query('SELECT 1 FROM roles WHERE name = $1', [name]);
    expect(exists.rowCount).toBe(0);
  });

  it.each([
    ['missing name', { permissions: [] }],
    ['blank name', { name: '   ' }],
    ['long name', { name: 'n'.repeat(101) }],
    ['long description', { name: 'ok', description: 'd'.repeat(501) }],
    ['permissions not an array', { name: 'ok', permissions: 'bookings:read' }],
    ['non-string permission', { name: 'ok', permissions: [1] }],
    ['isSystem flag', { name: 'ok', isSystem: true }],
    ['isSuperAdmin flag', { name: 'ok', isSuperAdmin: true }],
    ['unknown field', { name: 'ok', colour: 'red' }],
  ])('R-6 create rejects %s with 422', async (_name, body) => {
    const res = await call(superAdmin, 'POST', '/v1/admin/roles', body as Record<string, unknown>);
    expect(res.statusCode).toBe(422);
  });

  it('R-7 PATCH changes name/description and REPLACES permissions when sent; omitted fields stay', async () => {
    const role = await makeRole({ permissions: ['bookings:read', 'users:read'] });

    const renamed = await call(superAdmin, 'PATCH', `/v1/admin/roles/${role.id}`, {
      name: uniqueName('Renamed'),
    });
    expect(renamed.json<Role>().permissions).toEqual(['bookings:read', 'users:read']);

    const replaced = await call(superAdmin, 'PATCH', `/v1/admin/roles/${role.id}`, {
      permissions: ['reports:read'],
    });
    expect(replaced.json<Role>()).toMatchObject({ permissions: ['reports:read'] });

    const cleared = await call(superAdmin, 'PATCH', `/v1/admin/roles/${role.id}`, {
      permissions: [],
      description: null,
    });
    expect(cleared.json<Role>()).toMatchObject({ permissions: [], description: null });
    expect(new Date(cleared.json<Role>().updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(role.updatedAt).getTime(),
    );
  });

  it('R-8 PATCH validation: unknown permission leaves the role untouched; empty and odd bodies', async () => {
    const role = await makeRole({ permissions: ['bookings:read'] });
    const bad = await call(superAdmin, 'PATCH', `/v1/admin/roles/${role.id}`, {
      permissions: ['nope:nope'],
    });
    expect(bad.statusCode).toBe(422);
    expect(
      (await call(superAdmin, 'GET', `/v1/admin/roles/${role.id}`)).json<Role>().permissions,
    ).toEqual(['bookings:read']);
    for (const body of [{ name: '' }, { name: null }, { permissions: null }, { isSystem: false }]) {
      expect((await call(superAdmin, 'PATCH', `/v1/admin/roles/${role.id}`, body)).statusCode).toBe(
        422,
      );
    }
  });

  it('R-9 unknown or malformed ids are 404', async () => {
    for (const id of ['00000000-0000-4000-8000-000000000000', 'not-a-uuid']) {
      expect((await call(superAdmin, 'GET', `/v1/admin/roles/${id}`)).statusCode, id).toBe(404);
      expect(
        (await call(superAdmin, 'PATCH', `/v1/admin/roles/${id}`, { name: 'x' })).statusCode,
        id,
      ).toBe(404);
      expect((await call(superAdmin, 'DELETE', `/v1/admin/roles/${id}`)).statusCode, id).toBe(404);
    }
  });

  it('R-10 the Super Admin role cannot be edited or deleted: 409 ROLE_LOCKED', async () => {
    const sa = await superAdminRole();
    for (const res of [
      await call(superAdmin, 'PATCH', `/v1/admin/roles/${sa.id}`, { name: 'Hacked' }),
      await call(superAdmin, 'PATCH', `/v1/admin/roles/${sa.id}`, {
        permissions: ['bookings:read'],
      }),
      await call(superAdmin, 'DELETE', `/v1/admin/roles/${sa.id}`),
    ]) {
      expect(res.statusCode).toBe(409);
      expect(res.json<Problem>().code).toBe('ROLE_LOCKED');
    }
    expect(await superAdminRole()).toEqual(sa);
  });

  it('R-11 an assigned role cannot be deleted (409 ROLE_IN_USE) until the assignments are gone', async () => {
    const role = await makeRole();
    await database.pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [
      nobody.user.id,
      role.id,
    ]);
    expect(
      (await call(superAdmin, 'GET', `/v1/admin/roles/${role.id}`)).json<Role>().assignedCount,
    ).toBe(1);

    const res = await call(superAdmin, 'DELETE', `/v1/admin/roles/${role.id}`);
    expect(res.statusCode).toBe(409);
    expect(res.json<Problem>().code).toBe('ROLE_IN_USE');

    await database.pool.query('DELETE FROM user_roles WHERE role_id = $1', [role.id]);
    expect((await call(superAdmin, 'DELETE', `/v1/admin/roles/${role.id}`)).statusCode).toBe(204);
  });

  it('R-12 deleting a role removes it and its permission rows', async () => {
    const role = await makeRole({ permissions: ['bookings:read', 'users:read'] });
    expect((await call(superAdmin, 'DELETE', `/v1/admin/roles/${role.id}`)).statusCode).toBe(204);
    expect((await call(superAdmin, 'GET', `/v1/admin/roles/${role.id}`)).statusCode).toBe(404);
    const left = await database.pool.query('SELECT 1 FROM role_permissions WHERE role_id = $1', [
      role.id,
    ]);
    expect(left.rowCount).toBe(0);
  });
});

describe('concurrency', () => {
  it('R-13 creating the same name concurrently: exactly one wins, the rest are 422 (never 5xx)', async () => {
    const name = uniqueName('Race');
    const results = await Promise.all(Array.from({ length: 6 }, () => create({ name })));
    const statuses = results.map((r) => r.statusCode).sort();
    expect(statuses).toEqual([201, 422, 422, 422, 422, 422]);
    const rows = await database.pool.query('SELECT 1 FROM roles WHERE lower(name) = lower($1)', [
      name,
    ]);
    expect(rows.rowCount).toBe(1);
  });

  it("R-14 concurrent edits of one role end consistent: the permission set is exactly one request's", async () => {
    const role = await makeRole({ permissions: [] });
    const sets = [
      ['bookings:read'],
      ['users:read', 'reports:read'],
      ['audit:read'],
      ['settings:read', 'drawers:read'],
    ];
    const results = await Promise.all(
      sets.map((permissions) =>
        call(superAdmin, 'PATCH', `/v1/admin/roles/${role.id}`, { permissions }),
      ),
    );
    expect(results.every((r) => r.statusCode === 200)).toBe(true);
    const final = (await call(superAdmin, 'GET', `/v1/admin/roles/${role.id}`)).json<Role>()
      .permissions;
    expect(sets.map((s) => [...s].sort())).toContainEqual(final);
  });

  it('R-15 delete racing an assignment never loses the assignment or 5xx', async () => {
    for (let round = 0; round < 5; round += 1) {
      const role = await makeRole();
      const assigned = database.pool.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
        [nobody.user.id, role.id],
      );
      const deleted = call(superAdmin, 'DELETE', `/v1/admin/roles/${role.id}`);
      const [assignResult, deleteResult] = await Promise.allSettled([assigned, deleted]);
      const deleteStatus = deleteResult.status === 'fulfilled' ? deleteResult.value.statusCode : 0;
      expect([204, 409]).toContain(deleteStatus);
      if (deleteStatus === 204) {
        // the role is gone, so the assignment must have failed on the foreign key
        expect(assignResult.status).toBe('rejected');
      } else {
        expect(assignResult.status).toBe('fulfilled');
      }
      await database.pool.query('DELETE FROM user_roles WHERE role_id = $1', [role.id]);
    }
  });
});

describe('permission catalog endpoint', () => {
  it('P-1 returns the P2-08 catalog grouped, with descriptions', async () => {
    const res = await call(reader, 'GET', '/v1/admin/permissions');
    expect(res.statusCode).toBe(200);
    const groups =
      res.json<
        Array<{ group: string; permissions: Array<{ key: string; description: string }> }>
      >();
    expect(groups.flatMap((g) => g.permissions.map((p) => p.key))).toEqual(
      PERMISSIONS.map((p) => p.key),
    );
    expect(groups.map((g) => g.group)[0]).toBe('Inventory');
    expect(groups.every((g) => g.permissions.every((p) => p.description.length > 0))).toBe(true);
  });
});

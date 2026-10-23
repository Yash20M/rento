import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PermissionAuthority } from '../../src/modules/access-control/services/permission-authority';
import { AdminService } from '../../src/modules/access-control/services/admin.service';
import { grantPermissions, makeSuperAdmin } from '../support/access';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeClock } from '../support/fake-clock';
import { type TestSession, registerSession } from '../support/sessions';
import { createFactories, type Factories } from '../factories';

/**
 * P2-13 — anti-escalation (README §13.5): grant only what you hold, only a Super Admin hands out Super Admin, nobody
 * changes their own roles, nobody strips a superior, and the last active Super Admin always remains.
 */
let database: TestDatabase;
let app: TestApp;
let clock: FakeClock;
let f: Factories;
let superRoleId = '';

beforeAll(async () => {
  database = await createTestDatabase();
  f = createFactories(database.db);
  clock = new FakeClock('2030-01-01T00:00:00Z');
  app = await createTestApp({ config: testConfig({ DATABASE_URL: database.url }), clock });
  superRoleId = (
    await database.pool.query<{ id: string }>('SELECT id FROM roles WHERE is_super_admin')
  ).rows[0]!.id;
});
afterAll(async () => {
  await app.app.close();
  await database.drop();
});

const person = (tag: string) => registerSession(app, clock, tag);
const call = (who: TestSession, method: 'PUT' | 'DELETE' | 'POST', url: string, payload?: object) =>
  app.app.inject({
    method,
    url,
    headers: { authorization: `Bearer ${who.accessToken}` },
    ...(payload !== undefined && { payload }),
  });
const setRoles = (who: TestSession, target: TestSession, roles: object[]) =>
  call(who, 'PUT', `/v1/admin/admins/${target.user.id}/roles`, { roles });
const newRole = async (permissions: string[]) => {
  const holder = await person('rolemaker');
  return grantPermissions(database.pool, holder.user.id, permissions);
};
const rolesOf = async (id: string) =>
  (
    await database.pool.query<{ role_id: string; drawer_id: string | null }>(
      'SELECT role_id, drawer_id FROM user_roles WHERE user_id = $1',
      [id],
    )
  ).rows;
const code = (res: { json: <T>() => T }) => res.json<{ code: string }>().code;

describe('granting only what you hold', () => {
  it('E-1 a granter may hand out a role made of permissions they hold, not one with anything more', async () => {
    const manager = await person('manager');
    await grantPermissions(database.pool, manager.user.id, ['admins:manage', 'bookings:read']);
    const target = await person('target');
    const within = await newRole(['bookings:read']);
    const beyond = await newRole(['bookings:read', 'bookings:write']);

    expect((await setRoles(manager, target, [{ roleId: within }])).statusCode).toBe(200);
    expect((await rolesOf(target.user.id)).map((r) => r.role_id)).toEqual([within]);

    const refused = await setRoles(manager, target, [{ roleId: beyond }]);
    expect(refused.statusCode).toBe(403);
    expect(code(refused)).toBe('ROLE_ESCALATION');
    expect((await rolesOf(target.user.id)).map((r) => r.role_id)).toEqual([within]);
  });

  it('E-2 a drawer-limited granter cannot grant globally or for another drawer', async () => {
    const mine = (await f.drawer()).id;
    const other = (await f.drawer()).id;
    const manager = await person('scopedmgr');
    await grantPermissions(database.pool, manager.user.id, ['admins:manage'], null);
    await grantPermissions(database.pool, manager.user.id, ['bookings:read'], mine);
    const role = await newRole(['bookings:read']);
    const target = await person('scopedtarget');

    expect((await setRoles(manager, target, [{ roleId: role, drawerId: mine }])).statusCode).toBe(
      200,
    );
    for (const drawerId of [other, null]) {
      const res = await setRoles(manager, target, [{ roleId: role, drawerId }]);
      expect(res.statusCode, String(drawerId)).toBe(403);
      expect(code(res)).toBe('ROLE_ESCALATION');
    }
    expect(await rolesOf(target.user.id)).toEqual([{ role_id: role, drawer_id: mine }]);
  });

  it('E-3 invitations follow the same rule', async () => {
    const manager = await person('invmgr');
    await grantPermissions(database.pool, manager.user.id, ['admins:manage', 'bookings:read']);
    const within = await newRole(['bookings:read']);
    const beyond = await newRole(['users:write']);
    const ok = await call(manager, 'POST', '/v1/admin/admins/invitations', {
      email: `in-${Date.now()}@example.com`,
      roles: [{ roleId: within }],
    });
    expect(ok.statusCode).toBe(201);
    const bad = await call(manager, 'POST', '/v1/admin/admins/invitations', {
      email: `in2-${Date.now()}@example.com`,
      roles: [{ roleId: beyond }],
    });
    expect(bad.statusCode).toBe(403);
    expect(code(bad)).toBe('ROLE_ESCALATION');
  });
});

describe('Super Admin is special', () => {
  it('E-4 only a Super Admin grants Super Admin — even a granter holding every permission', async () => {
    const all = await database.pool.query<{ key: string }>('SELECT key FROM permissions');
    const manager = await person('almost');
    await grantPermissions(
      database.pool,
      manager.user.id,
      all.rows.map((r) => r.key),
    );
    const target = await person('hopeful');
    const res = await setRoles(manager, target, [{ roleId: superRoleId }]);
    expect(res.statusCode).toBe(403);
    expect(code(res)).toBe('ROLE_ESCALATION');
    expect(await rolesOf(target.user.id)).toEqual([]);

    const boss = await person('boss');
    await makeSuperAdmin(database.pool, boss.user.id);
    expect((await setRoles(boss, target, [{ roleId: superRoleId }])).statusCode).toBe(200);
  });

  it('E-5 nobody can strip a Super Admin of the role unless they are one', async () => {
    const manager = await person('stripper');
    await grantPermissions(database.pool, manager.user.id, ['admins:manage']);
    const [a, b] = [await person('superA'), await person('superB')];
    await makeSuperAdmin(database.pool, a.user.id);
    await makeSuperAdmin(database.pool, b.user.id);
    for (const res of [
      await setRoles(manager, a, []),
      await call(manager, 'DELETE', `/v1/admin/admins/${a.user.id}`),
    ]) {
      expect(res.statusCode).toBe(403);
      expect(code(res)).toBe('ROLE_ESCALATION');
    }
    expect((await rolesOf(a.user.id)).map((r) => r.role_id)).toEqual([superRoleId]);
    // …and a Super Admin can take it from another Super Admin while one remains.
    expect((await call(a, 'DELETE', `/v1/admin/admins/${b.user.id}`)).statusCode).toBe(204);
  });

  it('E-6 nobody changes their own roles, Super Admin included', async () => {
    const boss = await person('selfboss');
    await makeSuperAdmin(database.pool, boss.user.id);
    const manager = await person('selfmgr');
    await grantPermissions(database.pool, manager.user.id, ['admins:manage']);
    for (const who of [boss, manager]) {
      for (const res of [
        await setRoles(who, who, []),
        await call(who, 'DELETE', `/v1/admin/admins/${who.user.id}`),
      ]) {
        expect(res.statusCode).toBe(403);
        expect(code(res)).toBe('ROLE_ESCALATION');
      }
      expect((await rolesOf(who.user.id)).length).toBeGreaterThan(0);
    }
  });
});

describe('the last Super Admin', () => {
  it('E-7 two Super Admins removing each other at once: at least one remains, no 5xx (5 rounds)', async () => {
    for (let round = 0; round < 5; round += 1) {
      const [a, b] = [await person(`dueA${round}`), await person(`dueB${round}`)];
      await makeSuperAdmin(database.pool, a.user.id);
      await makeSuperAdmin(database.pool, b.user.id);
      const before = Number(
        (
          await database.pool.query<{ n: string }>(
            'SELECT count(DISTINCT user_id) n FROM user_roles WHERE role_id = $1',
            [superRoleId],
          )
        ).rows[0]!.n,
      );
      const results = await Promise.all([
        call(a, 'DELETE', `/v1/admin/admins/${b.user.id}`),
        call(b, 'DELETE', `/v1/admin/admins/${a.user.id}`),
      ]);
      for (const res of results) expect([204, 403, 409]).toContain(res.statusCode);
      const after = Number(
        (
          await database.pool.query<{ n: string }>(
            'SELECT count(DISTINCT user_id) n FROM user_roles WHERE role_id = $1',
            [superRoleId],
          )
        ).rows[0]!.n,
      );
      // Exactly one of the pair survives (the other earlier Super Admins of this file are untouched).
      expect(before - after).toBe(1);
      expect(results.filter((r) => r.statusCode === 204)).toHaveLength(1);
    }
  });

  it('E-8 the service itself refuses to remove the only ACTIVE Super Admin (backstop behind the escalation check)', async () => {
    const [actor, only] = [await person('suspendedSuper'), await person('onlyActive')];
    await makeSuperAdmin(database.pool, actor.user.id);
    await makeSuperAdmin(database.pool, only.user.id);
    // The actor's permissions are cached from before they were suspended: the stale-cache race the backstop is for.
    const cached = await createTestApp({
      config: testConfig({ DATABASE_URL: database.url, PERMISSION_CACHE_TTL_SECONDS: '60' }),
      clock,
    });
    await cached.app.get(PermissionAuthority).effective(actor.user.id);
    await database.pool.query(
      `UPDATE users SET status = 'suspended'
        WHERE id IN (SELECT user_id FROM user_roles WHERE role_id = $1) AND id <> $2`,
      [superRoleId, only.user.id],
    );
    await expect(
      cached.app.get(AdminService).deactivate({ id: actor.user.id, ip: '127.0.0.1' }, only.user.id),
    ).rejects.toMatchObject({ code: 'LAST_SUPER_ADMIN' });
    expect((await rolesOf(only.user.id)).map((r) => r.role_id)).toEqual([superRoleId]);
    await cached.app.close();
  });
});

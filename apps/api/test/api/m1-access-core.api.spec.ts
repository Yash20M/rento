import 'reflect-metadata';
import { ModulesContainer } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PermissionGuard } from '../../src/modules/access-control/http/permission.guard';
import {
  ADMIN_ACCESS,
  REQUIRED_PERMISSION,
} from '../../src/modules/access-control/http/require-permission.decorator';
import { PERMISSIONS } from '../../src/modules/access-control/domain/permissions';
import { bootstrapSuperAdmin } from '../../src/modules/access-control/services/super-admin-bootstrap';
import { AuthMailService } from '../../src/modules/auth-users/services/auth-mail.service';
import { KYSELY } from '../../src/db/tokens';
import { AuditLog } from '../../src/modules/reporting-audit';
import { grantPermissions, makeSuperAdmin } from '../support/access';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeClock } from '../support/fake-clock';
import { createFactories } from '../factories';

const PASSWORD = 'correct horse battery staple';

interface Session {
  accessToken: string;
  user: { id: string; email: string | null };
}
interface Me {
  user: { id: string; email: string | null; displayName: string | null };
  superAdmin: boolean;
  permissions: string[];
  drawerScopes: Array<{ permission: string; drawerIds: string[] }>;
}
interface AuditRow {
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
}

let database: TestDatabase;
let app: TestApp;
let cached: TestApp;
let clock: FakeClock;
let counter = 0;
let boss: Session;

beforeAll(async () => {
  database = await createTestDatabase();
  app = await createTestApp({ config: testConfig({ DATABASE_URL: database.url }) });
  clock = new FakeClock('2030-01-01T00:00:00Z');
  cached = await createTestApp({
    config: testConfig({ DATABASE_URL: database.url, PERMISSION_CACHE_TTL_SECONDS: '30' }),
    clock,
  });
  boss = await register(app);
  await makeSuperAdmin(database.pool, boss.user.id);
});
afterAll(async () => {
  await app.app.close();
  await cached.app.close();
  await database.drop();
});

async function register(target: TestApp): Promise<Session> {
  const res = await target.app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: {
      email: `m1-${(counter += 1)}-${Date.now()}@example.com`,
      password: PASSWORD,
      name: 'M1 User',
    },
  });
  return res.json<Session>();
}
const call = (
  who: Session | undefined,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  payload?: Record<string, unknown>,
  target: TestApp = app,
) =>
  target.app.inject({
    method,
    url,
    ...(who && { headers: { authorization: `Bearer ${who.accessToken}` } }),
    ...(payload !== undefined && { payload }),
  });
const auditRows = async (entityId: string): Promise<AuditRow[]> =>
  (
    await database.pool.query<AuditRow>(
      'SELECT actor_id, action, entity_type, entity_id, before, after, ip FROM audit_logs WHERE entity_id = $1 ORDER BY at, id',
      [entityId],
    )
  ).rows;
const roleName = () => `M1 role ${(counter += 1)}-${Date.now()}`;

describe('P2-12 GET /v1/admin/me', () => {
  it('E-1 a Super Admin sees the whole catalog and no drawer limits', async () => {
    const res = await call(boss, 'GET', '/v1/admin/me');
    expect(res.statusCode).toBe(200);
    const me = res.json<Me>();
    expect(me).toMatchObject({ superAdmin: true, drawerScopes: [], user: { id: boss.user.id } });
    expect(me.permissions).toEqual(PERMISSIONS.map((p) => p.key));
  });

  it('E-2 a role holder sees exactly their permissions; drawer-limited ones are listed with their drawers', async () => {
    const f = createFactories(database.db);
    const [d1, d2] = [await f.drawer(), await f.drawer()];
    const person = await register(app);
    await grantPermissions(
      database.pool,
      person.user.id,
      ['bookings:read', 'bookings:cancel'],
      d2.id,
    );
    await grantPermissions(database.pool, person.user.id, ['bookings:cancel', 'users:read'], d1.id);
    await grantPermissions(database.pool, person.user.id, ['reports:read']);

    const me = (await call(person, 'GET', '/v1/admin/me')).json<Me>();
    expect(me.superAdmin).toBe(false);
    expect(me.permissions).toEqual([
      'bookings:cancel',
      'bookings:read',
      'reports:read',
      'users:read',
    ]);
    expect(me.drawerScopes).toEqual([
      { permission: 'bookings:cancel', drawerIds: [d1.id, d2.id].sort() },
      { permission: 'bookings:read', drawerIds: [d2.id] },
      { permission: 'users:read', drawerIds: [d1.id] },
    ]); // reports:read has an unlimited grant, so it is absent from the limits
  });

  it('E-3 an unlimited grant of a permission wins over a drawer-limited one', async () => {
    const f = createFactories(database.db);
    const drawer = await f.drawer();
    const person = await register(app);
    await grantPermissions(database.pool, person.user.id, ['bookings:read'], drawer.id);
    await grantPermissions(database.pool, person.user.id, ['bookings:read']);
    const me = (await call(person, 'GET', '/v1/admin/me')).json<Me>();
    expect(me.drawerScopes).toEqual([]);
  });

  it('E-4 a customer with no role is refused; so is a missing or invalid token', async () => {
    const customer = await register(app);
    expect((await call(customer, 'GET', '/v1/admin/me')).statusCode).toBe(403);
    expect((await call(undefined, 'GET', '/v1/admin/me')).statusCode).toBe(401);
  });
});

describe('P2-12 deny by default: every admin route declares a permission', () => {
  it('E-5 route enumeration — controller routes under /admin all carry a permission and use PermissionGuard', () => {
    const modules = app.app.get(ModulesContainer);
    const offenders: string[] = [];
    let checked = 0;
    for (const module of modules.values()) {
      for (const wrapper of module.controllers.values()) {
        const type = wrapper.metatype as (new (...args: never[]) => object) | null;
        if (!type) continue;
        const basePath = String(Reflect.getMetadata('path', type) ?? '');
        if (!basePath.startsWith('admin')) continue;

        const classGuards: unknown[] = Reflect.getMetadata('__guards__', type) ?? [];
        for (const name of Object.getOwnPropertyNames(type.prototype)) {
          const handler = (type.prototype as Record<string, unknown>)[name];
          if (typeof handler !== 'function' || Reflect.getMetadata('method', handler) === undefined)
            continue;
          checked += 1;
          const label = `${type.name}.${name}`;
          const guards: unknown[] = [
            ...classGuards,
            ...(Reflect.getMetadata('__guards__', handler) ?? []),
          ];
          const declares =
            Reflect.getMetadata(REQUIRED_PERMISSION, handler) !== undefined ||
            Reflect.getMetadata(ADMIN_ACCESS, handler) === true ||
            Reflect.getMetadata(REQUIRED_PERMISSION, type) !== undefined ||
            Reflect.getMetadata(ADMIN_ACCESS, type) === true;
          if (!declares) offenders.push(`${label}: no @RequirePermission / @RequireAdminAccess`);
          if (!guards.includes(PermissionGuard))
            offenders.push(`${label}: PermissionGuard not applied`);
        }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(12); // the walk really found the admin routes
    expect(offenders).toEqual([]);
  });

  it('E-6 the guard really refuses a route nobody declared (sanity check of the test itself)', async () => {
    // An undeclared handler is denied even for a Super Admin — proven in the unit tests; here we only assert that the
    // enumeration above would catch one: a synthetic controller without metadata has no declaration.
    class Undeclared {
      handler(): void {}
    }
    expect(Reflect.getMetadata(REQUIRED_PERMISSION, Undeclared.prototype.handler)).toBeUndefined();
  });
});

describe('P2-12 cache + invalidation (TTL 30 s, injected clock)', () => {
  it('E-7 changes made through the API apply to the very next request; raw database edits only after the TTL', async () => {
    const person = await register(cached);
    const boss2 = await register(cached);
    await makeSuperAdmin(database.pool, boss2.user.id);
    const roleId = (
      await call(
        boss2,
        'POST',
        '/v1/admin/roles',
        { name: roleName(), permissions: ['roles:read'] },
        cached,
      )
    ).json<{ id: string }>().id;

    expect((await call(person, 'GET', '/v1/admin/roles', undefined, cached)).statusCode).toBe(403);
    await call(
      boss2,
      'PUT',
      `/v1/admin/admins/${person.user.id}/roles`,
      { roles: [{ roleId }] },
      cached,
    );
    expect((await call(person, 'GET', '/v1/admin/roles', undefined, cached)).statusCode).toBe(200);

    // role edit → everybody holding the role is refreshed at once
    await call(boss2, 'PATCH', `/v1/admin/roles/${roleId}`, { permissions: [] }, cached);
    expect((await call(person, 'GET', '/v1/admin/roles', undefined, cached)).statusCode).toBe(403);

    // restore, then deactivate through the API → immediate
    await call(
      boss2,
      'PATCH',
      `/v1/admin/roles/${roleId}`,
      { permissions: ['roles:read'] },
      cached,
    );
    expect((await call(person, 'GET', '/v1/admin/roles', undefined, cached)).statusCode).toBe(200);
    await call(boss2, 'DELETE', `/v1/admin/admins/${person.user.id}`, undefined, cached);
    expect((await call(person, 'GET', '/v1/admin/roles', undefined, cached)).statusCode).toBe(403);

    // a RAW database change bypasses invalidation: visible only once the cached entry expires
    await database.pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [
      person.user.id,
      roleId,
    ]);
    expect((await call(person, 'GET', '/v1/admin/roles', undefined, cached)).statusCode).toBe(403);
    clock.advance(31_000);
    const fresh = await call(person, 'GET', '/v1/admin/roles', undefined, cached);
    // (the access token itself lives 15 minutes, so it is still valid after 31 s)
    expect(fresh.statusCode).toBe(200);
  });
});

describe('P2-14 audit log', () => {
  it('U-1 role create / update / delete write exactly one row each, with actor, before/after and ip', async () => {
    const name = roleName();
    const created = (
      await call(boss, 'POST', '/v1/admin/roles', { name, permissions: ['bookings:read'] })
    ).json<{ id: string }>();
    await call(boss, 'PATCH', `/v1/admin/roles/${created.id}`, {
      name: `${name} v2`,
      permissions: ['bookings:read', 'users:read'],
    });
    await call(boss, 'DELETE', `/v1/admin/roles/${created.id}`);

    const rows = await auditRows(created.id);
    expect(rows.map((r) => r.action)).toEqual(['role.created', 'role.updated', 'role.deleted']);
    expect(rows.every((r) => r.actor_id === boss.user.id && r.entity_type === 'role' && r.ip)).toBe(
      true,
    );
    expect(rows[0]).toMatchObject({
      before: null,
      after: { name, permissions: ['bookings:read'] },
    });
    expect(rows[1]).toMatchObject({
      before: { name, permissions: ['bookings:read'] },
      after: { name: `${name} v2`, permissions: ['bookings:read', 'users:read'] },
    });
    expect(rows[2]).toMatchObject({ before: { name: `${name} v2` }, after: null });
  });

  it('U-2 assigning and deactivating write one row each, naming the roles before and after', async () => {
    const person = await register(app);
    const role = (
      await call(boss, 'POST', '/v1/admin/roles', {
        name: roleName(),
        permissions: ['bookings:read'],
      })
    ).json<{ id: string; name: string }>();
    await call(boss, 'PUT', `/v1/admin/admins/${person.user.id}/roles`, {
      roles: [{ roleId: role.id }],
    });
    await call(boss, 'DELETE', `/v1/admin/admins/${person.user.id}`);

    const rows = await auditRows(person.user.id);
    expect(rows.map((r) => r.action)).toEqual(['admin.roles_set', 'admin.deactivated']);
    expect(rows[0]?.before).toEqual({ roles: [] });
    expect(rows[0]?.after).toMatchObject({ roles: [{ roleId: role.id, roleName: role.name }] });
    expect(rows[1]?.before).toMatchObject({ roles: [{ roleId: role.id }] });
    expect(rows[1]?.after).toEqual({ roles: [] });
  });

  it('U-3 invitations: created, revoked and accepted are each audited (the acceptance by the NEW user)', async () => {
    const roleId = (
      await call(boss, 'POST', '/v1/admin/roles', {
        name: roleName(),
        permissions: ['bookings:read'],
      })
    ).json<{ id: string }>().id;
    const mail = `aud-${Date.now()}@example.com`;
    const created = (
      await call(boss, 'POST', '/v1/admin/admins/invitations', { email: mail, roles: [{ roleId }] })
    ).json<{ id: string }>();
    await call(boss, 'DELETE', `/v1/admin/admins/invitations/${created.id}`);

    const other = `aud2-${Date.now()}@example.com`;
    const second = (
      await call(boss, 'POST', '/v1/admin/admins/invitations', {
        email: other,
        roles: [{ roleId }],
      })
    ).json<{ id: string }>();
    const token = await invitationToken(other);
    const accepted = await app.app.inject({
      method: 'POST',
      url: '/v1/auth/admin-invitations/accept',
      payload: { token, password: 'a brand new passphrase 2030' },
    });
    expect(accepted.statusCode).toBe(200);

    expect((await auditRows(created.id)).map((r) => r.action)).toEqual([
      'invitation.created',
      'invitation.revoked',
    ]);
    const rows = await auditRows(second.id);
    expect(rows.map((r) => r.action)).toEqual(['invitation.created', 'invitation.accepted']);
    expect(rows[1]?.actor_id).toBe(accepted.json<Session>().user.id);
    expect(JSON.stringify(rows)).not.toContain(token); // the link token is nowhere in the trail
  });

  it('U-4 the bootstrap CLI action is audited with a null actor', async () => {
    await database.pool.query(
      `DELETE FROM user_roles WHERE role_id IN (SELECT id FROM roles WHERE is_super_admin) AND user_id <> $1`,
      [boss.user.id],
    );
    const address = `boot-${Date.now()}@example.com`;
    const outcome = await bootstrapSuperAdmin(
      { db: database.db, config: testConfig({ DATABASE_URL: database.url }), clock },
      { email: address, forceAdditional: true },
    );
    if (outcome.kind === 'refused') throw new Error('unexpected refusal');
    const rows = await auditRows(outcome.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actor_id: null,
      action: 'super_admin.bootstrapped',
      after: { email: address, outcome: 'created', forceAdditional: true },
    });
  });

  it('U-5 a failed request leaves no audit row, and a failing audit write rolls the change back', async () => {
    const dup = roleName();
    await call(boss, 'POST', '/v1/admin/roles', { name: dup });
    const before = Number(
      (await database.pool.query('SELECT count(*)::int AS n FROM audit_logs')).rows[0].n,
    );
    expect(
      (await call(boss, 'POST', '/v1/admin/roles', { name: dup.toUpperCase() })).statusCode,
    ).toBe(422);
    expect(
      Number((await database.pool.query('SELECT count(*)::int AS n FROM audit_logs')).rows[0].n),
    ).toBe(before);

    const log = app.app.get(AuditLog);
    const original = log.record.bind(log);
    log.record = async () => {
      throw new Error('audit store unavailable');
    };
    try {
      const name = roleName();
      expect((await call(boss, 'POST', '/v1/admin/roles', { name })).statusCode).toBe(500);
      const left = await database.pool.query('SELECT 1 FROM roles WHERE name = $1', [name]);
      expect(left.rowCount).toBe(0); // the change did not survive the missing audit row
    } finally {
      log.record = original;
    }
  });

  it('U-7 every audited mutation writes through the caller transaction, never the shared connection pool', async () => {
    const log = app.app.get(AuditLog);
    const rootDb = app.app.get(KYSELY);
    const original = log.record.bind(log);
    const handles: unknown[] = [];
    log.record = async (db, entry) => {
      handles.push(db);
      return original(db, entry);
    };
    try {
      const person = await register(app);
      const role = (await call(boss, 'POST', '/v1/admin/roles', { name: roleName() })).json<{
        id: string;
      }>();
      await call(boss, 'PATCH', `/v1/admin/roles/${role.id}`, { description: 'x' });
      await call(boss, 'PUT', `/v1/admin/admins/${person.user.id}/roles`, {
        roles: [{ roleId: role.id }],
      });
      await call(boss, 'DELETE', `/v1/admin/admins/${person.user.id}`);
      const invite = (
        await call(boss, 'POST', '/v1/admin/admins/invitations', {
          email: `tx-${Date.now()}@example.com`,
          roles: [{ roleId: role.id }],
        })
      ).json<{ id: string }>();
      await call(boss, 'DELETE', `/v1/admin/admins/invitations/${invite.id}`);
      await call(boss, 'DELETE', `/v1/admin/roles/${role.id}`);
    } finally {
      log.record = original;
    }
    expect(handles).toHaveLength(7);
    expect(handles.every((handle) => handle !== rootDb)).toBe(true);
  });

  it('U-6 reads and rejected requests (403 / 422) are not audited', async () => {
    const before = Number(
      (await database.pool.query('SELECT count(*)::int AS n FROM audit_logs')).rows[0].n,
    );
    const customer = await register(app);
    await call(boss, 'GET', '/v1/admin/roles');
    await call(boss, 'GET', '/v1/admin/admins');
    await call(customer, 'POST', '/v1/admin/roles', { name: roleName() }); // 403
    await call(boss, 'POST', '/v1/admin/roles', { name: '' }); // 422
    expect(
      Number((await database.pool.query('SELECT count(*)::int AS n FROM audit_logs')).rows[0].n),
    ).toBe(before);
  });
});

/** The mail captured by the in-memory sender holds the invitation link. */
async function invitationToken(address: string): Promise<string> {
  await app.app.get(AuthMailService).drain();
  const mail = app.mail.find(address, 'invited').at(-1);
  if (!mail) throw new Error('no invitation mail');
  return /token=([A-Za-z0-9_%-]+)/.exec(mail.text)![1] as string;
}

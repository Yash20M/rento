import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createFactories, type Factories } from '../factories';
import { grantPermissions, makeSuperAdmin } from '../support/access';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeClock } from '../support/fake-clock';
import { type TestSession, freshSession, registerSession } from '../support/sessions';

/**
 * The role × operation matrix (P3-10, API half; the screens have the same matrix in the admin app's tests). Every cell
 * is a real request: a role that lacks the permission gets 403 — whatever the screens hide — and a role that has it
 * gets past the permission check (the dummy request then fails for its own reasons: 404, 422…, never 403).
 */
const START = '2030-01-07T03:00:00Z';
const NOBODY = '00000000-0000-4000-8000-000000000000';
const WINDOW = 'startsAt=2030-01-01T00:00:00Z&endsAt=2030-01-02T00:00:00Z';

interface Op {
  name: string;
  method: 'GET' | 'POST';
  url: string;
  permission: string;
}
const OPERATIONS: Op[] = [
  { name: 'list bookings', method: 'GET', url: '/v1/admin/bookings', permission: 'bookings:read' },
  { name: 'dashboard', method: 'GET', url: '/v1/admin/dashboard', permission: 'bookings:read' },
  {
    name: 'schedule',
    method: 'GET',
    url: `/v1/admin/drawers/${NOBODY}/schedule?${WINDOW}`,
    permission: 'bookings:read',
  },
  {
    name: 'hand over',
    method: 'POST',
    url: `/v1/admin/bookings/${NOBODY}/pickup`,
    permission: 'bookings:write',
  },
  {
    name: 'move to another unit',
    method: 'POST',
    url: `/v1/admin/bookings/${NOBODY}/reassign`,
    permission: 'bookings:write',
  },
  {
    name: 'cancel a booking',
    method: 'POST',
    url: `/v1/admin/bookings/${NOBODY}/cancel`,
    permission: 'bookings:cancel',
  },
  { name: 'list customers', method: 'GET', url: '/v1/admin/customers', permission: 'users:read' },
  {
    name: 'suspend a customer',
    method: 'POST',
    url: `/v1/admin/customers/${NOBODY}/status`,
    permission: 'users:write',
  },
  {
    name: 'decide a customer’s identity',
    method: 'POST',
    url: `/v1/admin/customers/${NOBODY}/kyc`,
    permission: 'users:write',
  },
  { name: 'payments ledger', method: 'GET', url: '/v1/admin/payments', permission: 'reports:read' },
  { name: 'reports', method: 'GET', url: '/v1/admin/reports/summary', permission: 'reports:read' },
  { name: 'settings', method: 'GET', url: '/v1/admin/settings', permission: 'settings:read' },
  { name: 'audit log', method: 'GET', url: '/v1/admin/audit-logs', permission: 'audit:read' },
  { name: 'list roles', method: 'GET', url: '/v1/admin/roles', permission: 'roles:read' },
  { name: 'list staff', method: 'GET', url: '/v1/admin/admins', permission: 'admins:read' },
  {
    name: 'list categories',
    method: 'GET',
    url: '/v1/admin/categories',
    permission: 'inventory:read',
  },
  {
    name: 'create a category',
    method: 'POST',
    url: '/v1/admin/categories',
    permission: 'inventory:write',
  },
  {
    name: 'list item models',
    method: 'GET',
    url: '/v1/admin/item-models',
    permission: 'inventory:read',
  },
  {
    name: 'create an item model',
    method: 'POST',
    url: '/v1/admin/item-models',
    permission: 'inventory:write',
  },
  {
    name: 'add a product photo',
    method: 'POST',
    url: `/v1/admin/item-models/${NOBODY}/photos`,
    permission: 'inventory:write',
  },
  { name: 'list assets', method: 'GET', url: '/v1/admin/assets', permission: 'assets:read' },
  { name: 'create an asset', method: 'POST', url: '/v1/admin/assets', permission: 'assets:write' },
  {
    name: 'block an asset',
    method: 'POST',
    url: `/v1/admin/assets/${NOBODY}/blocks`,
    permission: 'assets:write',
  },
  {
    name: 'start a transfer',
    method: 'POST',
    url: `/v1/admin/assets/${NOBODY}/transfer`,
    permission: 'assets:transfer',
  },
  { name: 'list drawers', method: 'GET', url: '/v1/admin/drawers', permission: 'drawers:read' },
  {
    name: 'create a drawer',
    method: 'POST',
    url: '/v1/admin/drawers',
    permission: 'drawers:write',
  },
];

/** The roles an operator might really be given (README §13.5). */
const ROLES: Record<string, { permissions: string[]; scoped?: boolean }> = {
  'Operations Manager': {
    permissions: [
      'bookings:read',
      'bookings:write',
      'bookings:cancel',
      'bookings:refund',
      'assets:read',
      'assets:write',
      'assets:transfer',
      'drawers:read',
      'drawers:write',
      'inventory:read',
      'inventory:write',
      'users:read',
      'reports:read',
    ],
  },
  'Drawer Staff (one drawer)': {
    permissions: [
      'bookings:read',
      'bookings:write',
      'bookings:cancel',
      'assets:read',
      'drawers:read',
    ],
    scoped: true,
  },
  'Support Agent': {
    permissions: ['bookings:read', 'bookings:cancel', 'users:read', 'users:write'],
  },
  Viewer: {
    permissions: [
      'bookings:read',
      'reports:read',
      'audit:read',
      'inventory:read',
      'drawers:read',
      'assets:read',
    ],
  },
  'No role': { permissions: [] },
};

let database: TestDatabase;
let app: TestApp;
let clock: FakeClock;
let f: Factories;
const sessions = new Map<string, TestSession>();
let drawerA = '';
let drawerB = '';

beforeAll(async () => {
  database = await createTestDatabase();
  f = createFactories(database.db);
  clock = new FakeClock(START);
  app = await createTestApp({ config: testConfig({ DATABASE_URL: database.url }), clock });
  drawerA = (await f.drawer()).id;
  drawerB = (await f.drawer()).id;
  const boss = await registerSession(app, clock, 'boss');
  await makeSuperAdmin(database.pool, boss.user.id);
  sessions.set('Super Admin', boss);
  for (const [name, role] of Object.entries(ROLES)) {
    const s = await registerSession(app, clock, name.replace(/\W+/g, ''));
    if (role.permissions.length > 0) {
      await grantPermissions(
        database.pool,
        s.user.id,
        role.permissions,
        role.scoped ? drawerA : null,
      );
    }
    sessions.set(name, s);
  }
});
afterAll(async () => {
  await app.app.close();
  await database.drop();
});

const send = async (who: TestSession | null, op: Op) => {
  const token = who ? (await freshSession(app, clock, who)).accessToken : undefined;
  return app.app.inject({
    method: op.method,
    url: op.url,
    headers: { ...(token && { authorization: `Bearer ${token}` }) },
    ...(op.method === 'POST' && { payload: {} }),
  });
};

describe('role × operation matrix', () => {
  const roles = ['Super Admin', ...Object.keys(ROLES)];
  for (const role of roles) {
    it(`M-${role}: exactly the operations its permissions allow get past the guard`, async () => {
      const granted = new Set(
        role === 'Super Admin' ? OPERATIONS.map((o) => o.permission) : ROLES[role]!.permissions,
      );
      const wrong: string[] = [];
      for (const op of OPERATIONS) {
        const res = await send(sessions.get(role)!, op);
        const allowed = granted.has(op.permission);
        const ok = allowed
          ? res.statusCode !== 403 && res.statusCode !== 401
          : res.statusCode === 403;
        if (!ok)
          wrong.push(
            `${op.method} ${op.name} (${op.permission}): got ${res.statusCode}, expected ${allowed ? 'not 403' : '403'}`,
          );
      }
      expect(wrong).toEqual([]);
    });
  }

  it('M-anonymous: every operation needs a signed-in user', async () => {
    const wrong: string[] = [];
    for (const op of OPERATIONS) {
      const res = await send(null, op);
      if (res.statusCode !== 401) wrong.push(`${op.name}: ${res.statusCode}`);
    }
    expect(wrong).toEqual([]);
  });

  it('M-staff-only: roles and staff management stay with the Super Admin whatever permissions say', async () => {
    const viewer = sessions.get('Viewer')!;
    await database.pool.query(
      `INSERT INTO role_permissions (role_id, permission_key)
       SELECT ur.role_id, p FROM user_roles ur, unnest(ARRAY['roles:read','roles:manage','admins:read','admins:manage']) AS p
        WHERE ur.user_id = $1 ON CONFLICT DO NOTHING`,
      [viewer.user.id],
    );
    // Even with the permission keys, creating a role is Super-Admin-only, and a manager cannot invite someone as Super Admin (anti-escalation, README §13.5).
    const create = await app.app.inject({
      method: 'POST',
      url: '/v1/admin/roles',
      headers: { authorization: `Bearer ${(await freshSession(app, clock, viewer)).accessToken}` },
      payload: { name: 'Sneaky', permissions: ['bookings:read'] },
    });
    expect(create.statusCode).toBe(403);
    const invite = await app.app.inject({
      method: 'POST',
      url: '/v1/admin/admins/invitations',
      headers: { authorization: `Bearer ${(await freshSession(app, clock, viewer)).accessToken}` },
      payload: {
        email: 'sneaky@example.com',
        roles: [
          {
            roleId: (await database.pool.query('SELECT id FROM roles WHERE is_super_admin')).rows[0]
              .id,
          },
        ],
      },
    });
    expect(invite.statusCode).toBe(403);
  });
});

describe('drawer scope', () => {
  it('M-scope: a drawer-limited role sees and changes only its own drawer', async () => {
    const staff = sessions.get('Drawer Staff (one drawer)')!;
    const model = await f.itemModel();
    const make = async (drawerId: string, code: string) => {
      const asset = await f.asset({
        drawer_id: drawerId,
        item_model_id: model.id,
        asset_code: code,
      });
      const user = await registerSession(app, clock, `cust${code}`);
      const booking = await database.pool.query(
        `INSERT INTO bookings (user_id, asset_id, drawer_id, item_model_id, status, starts_at, ends_at, price_paise, deposit_paise)
         VALUES ($1, $2, $3, $4, 'confirmed', '2030-01-09T05:00:00Z', '2030-01-09T06:00:00Z', 9800, 20000) RETURNING id`,
        [user.user.id, asset.id, drawerId, model.id],
      );
      return booking.rows[0].id as string;
    };
    const mine = await make(drawerA, 'SC-A');
    const theirs = await make(drawerB, 'SC-B');
    const token = (await freshSession(app, clock, staff)).accessToken;
    const get = (id: string) =>
      app.app.inject({
        method: 'GET',
        url: `/v1/admin/bookings/${id}`,
        headers: { authorization: `Bearer ${token}` },
      });

    expect((await get(mine)).statusCode).toBe(200);
    expect((await get(theirs)).statusCode).toBe(404); // not "forbidden": it does not even exist for them
    const list = await app.app.inject({
      method: 'GET',
      url: '/v1/admin/bookings',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.json<{ items: Array<{ id: string }> }>().items.map((b) => b.id)).toEqual([mine]);
    const cancelOther = await app.app.inject({
      method: 'POST',
      url: `/v1/admin/bookings/${theirs}/cancel`,
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: 'not mine to cancel' },
    });
    expect(cancelOther.statusCode).toBe(404);
    expect(
      (await database.pool.query('SELECT status FROM bookings WHERE id = $1', [theirs])).rows[0]
        .status,
    ).toBe('confirmed');
    // Customers are not tied to a drawer: a drawer-limited grant is refused there (users:* not granted anyway).
    const people = await app.app.inject({
      method: 'GET',
      url: '/v1/admin/customers',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(people.statusCode).toBe(403);
  });
});

import { SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createFactories, type Factories } from '../factories';
import { grantPermissions, makeSuperAdmin } from '../support/access';
import {
  TEST_JWT_SECRET,
  type TestApp,
  createTestApp,
  testConfig,
} from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeClock } from '../support/fake-clock';
import {
  TEST_PASSWORD,
  type TestSession,
  freshSession,
  registerSession,
} from '../support/sessions';

const START = '2030-01-07T03:00:00Z';
const MIN = 60_000;
const NOBODY = '00000000-0000-4000-8000-000000000000';

interface Booking {
  id: string;
  status: string;
}
interface Checkout {
  orderId: string;
  paymentId: string;
  signature: string;
}

let database: TestDatabase;
let app: TestApp;
let clock: FakeClock;
let f: Factories;
let counter = 0;

beforeAll(async () => {
  database = await createTestDatabase();
  f = createFactories(database.db);
  clock = new FakeClock(START);
  app = await createTestApp({ config: testConfig({ DATABASE_URL: database.url }), clock });
});
afterAll(async () => {
  await app.app.close();
  await database.drop();
});

const call = async (
  who: TestSession | string | null,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  payload?: Record<string, unknown>,
  headers: Record<string, string> = {},
) => {
  const token =
    typeof who === 'string' ? who : who ? (await freshSession(app, clock, who)).accessToken : null;
  return app.app.inject({
    method,
    url,
    headers: { ...(token && { authorization: `Bearer ${token}` }), ...headers },
    ...(payload !== undefined && { payload }),
  });
};

async function world() {
  const drawer = await f.drawer();
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    await database.pool.query(
      `INSERT INTO drawer_hours (drawer_id, weekday, opens_at, closes_at) VALUES ($1, $2, '00:00', '23:59')`,
      [drawer.id, weekday],
    );
  }
  const model = await f.itemModel({
    slot_minutes: 30,
    min_duration_min: 30,
    max_duration_min: 240,
    price_per_slot_paise: 4900,
    deposit_paise: 20000,
  });
  await f.asset({
    drawer_id: drawer.id,
    item_model_id: model.id,
    asset_code: `SEC-${(counter += 1)}`,
  });
  return { drawerId: drawer.id, modelId: model.id };
}
async function hold(who: TestSession, w: { drawerId: string; modelId: string }, startsAt: string) {
  const res = await call(
    who,
    'POST',
    '/v1/bookings',
    { drawerId: w.drawerId, itemModelId: w.modelId, startsAt, durationMinutes: 60 },
    { 'idempotency-key': `sec-${(counter += 1)}-${Date.now()}` },
  );
  expect(res.statusCode, res.body).toBe(201);
  return res.json<Booking>();
}
async function paid(who: TestSession, id: string) {
  await call(who, 'POST', `/v1/bookings/${id}/payment`);
  const checkout = (
    await call(who, 'POST', `/v1/bookings/${id}/payment/simulate`)
  ).json<Checkout>();
  const res = await call(who, 'POST', `/v1/bookings/${id}/payment/confirm`, checkout as never);
  expect(res.statusCode, res.body).toBe(200);
}

describe('deleting your own account', () => {
  it('X-1 GET /v1/me shows the profile; without a token it is refused', async () => {
    const s = await registerSession(app, clock, 'me');
    const res = await call(s, 'GET', '/v1/me');
    expect(res.statusCode).toBe(200);
    expect(res.json<{ email: string; emailVerified: boolean }>()).toMatchObject({
      email: s.email,
      emailVerified: false,
    });
    expect((await call(null, 'GET', '/v1/me')).statusCode).toBe(401);
  });

  it('X-2 a wrong or missing password changes nothing; the right one removes every trace of the person and ends every session', async () => {
    const s = await registerSession(app, clock, 'gone');
    const login = await app.app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: s.email, password: TEST_PASSWORD },
    });
    const refreshToken = login.json<{ refreshToken: string }>().refreshToken;
    await database.pool.query(`UPDATE users SET phone = '+919876543210' WHERE id = $1`, [
      s.user.id,
    ]);
    await database.pool.query(
      `INSERT INTO user_kyc (user_id, status, method, aadhaar_last4, aadhaar_hash, verified_at)
       VALUES ($1, 'verified', 'aadhaar_otp', '1234', $2, now())`,
      [s.user.id, `hash-${s.user.id}`],
    );

    expect((await call(s, 'DELETE', '/v1/me', {})).statusCode).toBe(401);
    expect((await call(s, 'DELETE', '/v1/me', { password: 'not my password' })).statusCode).toBe(
      401,
    );
    const still = await database.pool.query('SELECT status, email FROM users WHERE id = $1', [
      s.user.id,
    ]);
    expect(still.rows[0]).toMatchObject({ status: 'active', email: s.email });

    const res = await call(s, 'DELETE', '/v1/me', { password: TEST_PASSWORD });
    expect(res.statusCode, res.body).toBe(204);

    const row = (await database.pool.query('SELECT * FROM users WHERE id = $1', [s.user.id]))
      .rows[0];
    expect(row).toMatchObject({
      status: 'deleted',
      email: null,
      phone: null,
      display_name: null,
      email_verified_at: null,
    });
    for (const table of ['user_identities', 'user_kyc', 'kyc_requests', 'auth_tokens']) {
      const left = await database.pool.query(`SELECT 1 FROM ${table} WHERE user_id = $1`, [
        s.user.id,
      ]);
      expect(left.rowCount, table).toBe(0);
    }
    const audit = await database.pool.query(
      `SELECT actor_id FROM audit_logs WHERE action = 'account.deleted' AND entity_id = $1`,
      [s.user.id],
    );
    expect(audit.rows).toEqual([{ actor_id: s.user.id }]);

    // Every way back in is closed.
    const again = await app.app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: s.email, password: TEST_PASSWORD },
    });
    expect(again.statusCode).toBe(401);
    const refresh = await app.app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(refresh.statusCode).toBe(401);
    expect((await call(s, 'GET', '/v1/me')).statusCode).toBe(401); // even a still-valid access token
    // The address is free again: the same person (or someone else) can register anew.
    const reborn = await app.app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: s.email, password: TEST_PASSWORD, name: 'New start' },
    });
    expect(reborn.statusCode).toBe(201);
  });

  it('X-3 a live booking blocks deletion; after cancelling it works, and the money trail stays', async () => {
    const w = await world();
    const s = await registerSession(app, clock, 'live');
    const b = await hold(s, w, '2030-01-09T05:00:00Z');
    await paid(s, b.id);
    const blocked = await call(s, 'DELETE', '/v1/me', { password: TEST_PASSWORD });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json<{ code: string }>().code).toBe('HAS_FUTURE_BOOKINGS');

    await call(s, 'POST', `/v1/bookings/${b.id}/cancel`);
    expect((await call(s, 'DELETE', '/v1/me', { password: TEST_PASSWORD })).statusCode).toBe(204);
    const kept = await database.pool.query(
      `SELECT b.status, p.status AS payment, r.amount_paise AS refund
         FROM bookings b JOIN payments p ON p.booking_id = b.id LEFT JOIN refunds r ON r.booking_id = b.id
        WHERE b.id = $1`,
      [b.id],
    );
    expect(kept.rows[0]).toMatchObject({ status: 'cancelled' });
    expect(kept.rows[0].refund).toBeGreaterThan(0);
  });

  it('X-4 staff accounts cannot be deleted this way', async () => {
    const staff = await registerSession(app, clock, 'staff');
    await grantPermissions(database.pool, staff.user.id, ['bookings:read']);
    const res = await call(staff, 'DELETE', '/v1/me', { password: TEST_PASSWORD });
    expect(res.statusCode).toBe(409);
    expect(res.json<{ code: string }>().code).toBe('INVALID_STATE');
  });

  it('X-5 an account with no password must have signed in recently', async () => {
    const s = await registerSession(app, clock, 'social');
    await database.pool.query(
      `UPDATE user_identities SET provider = 'google', provider_subject = $2, password_hash = NULL WHERE user_id = $1`,
      [s.user.id, `g-${s.user.id}`],
    );
    // Within the fresh-sign-in window: allowed.
    const ok = await call(s.accessToken, 'DELETE', '/v1/me', {});
    expect(ok.statusCode, ok.body).toBe(204);

    const old = await registerSession(app, clock, 'social-old');
    await database.pool.query(
      `UPDATE user_identities SET provider = 'google', provider_subject = $2, password_hash = NULL WHERE user_id = $1`,
      [old.user.id, `g-${old.user.id}`],
    );
    const token = old.accessToken;
    clock.advance(10 * MIN); // the token is still valid, but the sign-in is no longer recent
    try {
      const res = await call(token, 'DELETE', '/v1/me', {});
      expect([401]).toContain(res.statusCode);
      expect(['REAUTH_REQUIRED', 'TOKEN_EXPIRED']).toContain(res.json<{ code: string }>().code);
    } finally {
      clock.set(START);
    }
  });
});

describe('security regression (P2-35)', () => {
  it('X-6 nobody can touch another customer’s booking: every route answers 404, exactly like a booking that does not exist', async () => {
    const w = await world();
    const owner = await registerSession(app, clock, 'owner');
    const thief = await registerSession(app, clock, 'thief');
    const b = await hold(owner, w, '2030-01-09T05:00:00Z');
    await paid(owner, b.id);

    const probes: Array<[string, string, Record<string, unknown>?]> = [
      ['GET', `/v1/bookings/ID`],
      ['POST', `/v1/bookings/ID/payment`],
      ['POST', `/v1/bookings/ID/payment/simulate`],
      ['POST', `/v1/bookings/ID/payment/confirm`, { orderId: 'o', paymentId: 'p', signature: 's' }],
      ['POST', `/v1/bookings/ID/cancel`],
      ['POST', `/v1/bookings/ID/extend`, { extraMinutes: 30 }],
      ['POST', `/v1/bookings/ID/extensions/${NOBODY}/simulate`],
      [
        'POST',
        `/v1/bookings/ID/extensions/${NOBODY}/confirm`,
        { orderId: 'o', paymentId: 'p', signature: 's' },
      ],
    ];
    for (const [method, template, body] of probes) {
      const url = (id: string) => template.replace('ID', id);
      const mine = await call(thief, method as 'GET' | 'POST', url(b.id), body);
      const missing = await call(thief, method as 'GET' | 'POST', url(NOBODY), body);
      expect(mine.statusCode, `${method} ${template}`).toBe(404);
      const norm = (body: string) => body.replace(/"traceId":"[^"]+"/, '"traceId":"t"');
      expect(norm(mine.body), `${method} ${template}: same answer as for a missing booking`).toBe(
        norm(missing.body),
      );
    }
    // The booking is untouched.
    const row = await database.pool.query('SELECT status FROM bookings WHERE id = $1', [b.id]);
    expect(row.rows[0].status).toBe('confirmed');
    expect(
      (await call(thief, 'GET', '/v1/bookings')).json<Booking[]>().map((x) => x.id),
    ).not.toContain(b.id);
  });

  it('X-7 forged, tampered and foreign tokens are refused on customer and admin routes alike', async () => {
    const s = await registerSession(app, clock, 'jwt');
    await makeSuperAdmin(database.pool, s.user.id);
    const secret = new TextEncoder().encode(TEST_JWT_SECRET);
    const now = Math.floor(clock.now().getTime() / 1000);
    const claims = (o: { iss?: string; aud?: string; exp?: number; sub?: string } = {}) =>
      new SignJWT({ auth_time: now })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(o.sub ?? s.user.id)
        .setIssuer(o.iss ?? 'rento-api')
        .setAudience(o.aud ?? 'rento-clients')
        .setIssuedAt(now)
        .setExpirationTime(o.exp ?? now + 900)
        .setJti(`jti-${Math.random()}`);

    const good = (await freshSession(app, clock, s)).accessToken;
    const [header, payload, signature] = good.split('.') as [string, string, string];
    const swapSub = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), sub: NOBODY }),
    ).toString('base64url');
    const noneHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
      'base64url',
    );

    const forged: Record<string, string> = {
      'alg none': `${noneHeader}.${payload}.`,
      'alg none with the old signature': `${noneHeader}.${payload}.${signature}`,
      'payload changed, signature kept': `${header}.${swapSub}.${signature}`,
      'signed with another key': await claims().sign(
        new TextEncoder().encode('another-secret-another-secret-0123'),
      ),
      'wrong audience': await claims({ aud: 'someone-else' }).sign(secret),
      'wrong issuer': await claims({ iss: 'evil-api' }).sign(secret),
      'expired long ago': await claims({ exp: now - 3600 }).sign(secret),
      garbage: 'not.a.jwt',
      truncated: good.slice(0, good.length - 8),
    };
    for (const [label, token] of Object.entries(forged)) {
      for (const url of ['/v1/me', '/v1/bookings', '/v1/admin/me', '/v1/admin/dashboard']) {
        const res = await call(token, 'GET', url);
        expect(res.statusCode, `${label} → ${url}`).toBe(401);
      }
    }
    // Control: the genuine token works on the same routes.
    expect((await call(good, 'GET', '/v1/admin/me')).statusCode).toBe(200);
  });

  it('X-8 a customer token on any admin route is refused (403), and with no token 401', async () => {
    const customer = await registerSession(app, clock, 'plain');
    const get = [
      '/v1/admin/me',
      '/v1/admin/bookings',
      '/v1/admin/dashboard',
      '/v1/admin/customers',
      '/v1/admin/payments',
      '/v1/admin/reports/summary?from=2030-01-01T00:00:00Z&to=2030-01-02T00:00:00Z',
      '/v1/admin/settings',
      '/v1/admin/audit-logs',
      '/v1/admin/roles',
      '/v1/admin/admins',
      '/v1/admin/permissions',
      '/v1/admin/assets',
      '/v1/admin/categories',
      '/v1/admin/item-models',
      '/v1/admin/drawers',
      `/v1/admin/drawers/${NOBODY}/schedule?startsAt=2030-01-01T00:00:00Z&endsAt=2030-01-02T00:00:00Z`,
      `/v1/admin/assets/${NOBODY}/blocks`,
      `/v1/admin/assets/${NOBODY}/transfer`,
    ];
    for (const url of get) {
      expect((await call(customer, 'GET', url)).statusCode, `customer GET ${url}`).toBe(403);
      expect((await call(null, 'GET', url)).statusCode, `anonymous GET ${url}`).toBe(401);
    }
    const post: Array<[string, Record<string, unknown>]> = [
      [`/v1/admin/bookings/${NOBODY}/cancel`, { reason: 'because' }],
      [`/v1/admin/bookings/${NOBODY}/pickup`, {}],
      [`/v1/admin/bookings/${NOBODY}/reassign`, { reason: 'because' }],
      [`/v1/admin/customers/${NOBODY}/status`, { status: 'suspended', reason: 'because' }],
      [`/v1/admin/customers/${NOBODY}/kyc`, { decision: 'approve', reason: 'because' }],
      [
        `/v1/admin/assets/${NOBODY}/blocks`,
        { startsAt: '2030-01-01T00:00:00Z', endsAt: '2030-01-02T00:00:00Z', reason: 'x' },
      ],
      [`/v1/admin/item-models/${NOBODY}/photos`, {}],
      ['/v1/admin/categories', { name: 'Sneaky' }],
      ['/v1/admin/roles', { name: 'Sneaky', permissions: [] }],
    ];
    for (const [url, body] of post) {
      expect((await call(customer, 'POST', url, body)).statusCode, `customer POST ${url}`).toBe(
        403,
      );
      expect((await call(null, 'POST', url, body)).statusCode, `anonymous POST ${url}`).toBe(401);
    }
  });

  it('X-9 a suspended customer is turned away from booking at once, even with an unexpired token', async () => {
    const w = await world();
    const s = await registerSession(app, clock, 'susp');
    await database.pool.query(`UPDATE users SET status = 'suspended' WHERE id = $1`, [s.user.id]);
    const res = await call(
      s.accessToken,
      'POST',
      '/v1/bookings',
      {
        drawerId: w.drawerId,
        itemModelId: w.modelId,
        startsAt: '2030-01-09T05:00:00Z',
        durationMinutes: 60,
      },
      { 'idempotency-key': `susp-${Date.now()}` },
    );
    expect(res.statusCode).toBe(403);
  });
});

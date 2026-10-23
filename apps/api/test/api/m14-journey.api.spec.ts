import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createFactories, type Factories } from '../factories';
import { makeSuperAdmin } from '../support/access';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeClock } from '../support/fake-clock';
import { registerSession, type TestSession, TEST_PASSWORD } from '../support/sessions';
import { aadhaarFrom } from '../unit/aadhaar.unit.spec';

/**
 * One story across every role and screen the apps use (P3-25): the customer app and the admin panel talk to the same
 * API, so this test plays both through the public HTTP contract only — in the order a real day happens.
 */
const START = '2030-01-07T03:00:00Z'; // Monday 08:30 IST
const OTP = '123456';
const MIN = 60_000;
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('cover'),
]);

let database: TestDatabase;
let app: TestApp;
let clock: FakeClock;
let f: Factories;
let admin: { email: string; token: string; cookie: string };
let boss: TestSession;
let customerToken = '';
let customerEmail = '';

beforeAll(async () => {
  database = await createTestDatabase();
  f = createFactories(database.db);
  clock = new FakeClock(START);
  app = await createTestApp({
    config: testConfig({
      DATABASE_URL: database.url,
      KYC_REQUIRED: 'true',
      KYC_FAKE_OTP: OTP,
      CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
    }),
    clock,
  });
  boss = await registerSession(app, clock, 'owner');
  await makeSuperAdmin(database.pool, boss.user.id);
});
afterAll(async () => {
  await app.app.close();
  await database.drop();
});

type Who = 'admin' | 'customer' | undefined;
const issued: Record<string, number> = {};
/** Access tokens follow the fake clock: renew them the way the apps do (cookie refresh / sign in) after a long jump. */
async function bearer(who: 'admin' | 'customer'): Promise<string> {
  const now = clock.now().getTime();
  if (issued[who] !== undefined && Math.abs(now - issued[who]!) <= 5 * MIN) {
    return who === 'admin' ? admin.token : customerToken;
  }
  if (who === 'admin') {
    const res = await app.app.inject({
      method: 'POST',
      url: '/v1/auth/session/refresh',
      headers: { 'x-requested-with': 'rento-web', cookie: admin.cookie },
    });
    admin.token = res.json<{ accessToken: string }>().accessToken;
    admin.cookie = String(res.headers['set-cookie']).split(';')[0]!;
  } else {
    const res = await app.app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: customerEmail, password: TEST_PASSWORD },
    });
    customerToken = res.json<{ accessToken: string }>().accessToken;
  }
  issued[who] = now;
  return who === 'admin' ? admin.token : customerToken;
}
const http = async (
  who: Who,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  payload?: unknown,
  headers: Record<string, string> = {},
) =>
  app.app.inject({
    method,
    url,
    headers: { ...(who && { authorization: `Bearer ${await bearer(who)}` }), ...headers },
    ...(payload !== undefined && { payload: payload as Record<string, unknown> }),
  });

describe('a day in the life of Rento', () => {
  const world: Record<string, string> = {};

  it('J-1 the owner signs in to the admin panel with a browser session (cookie), and sees the catalogue tools', async () => {
    const res = await http(
      undefined,
      'POST',
      '/v1/auth/session/login',
      { email: boss.email, password: TEST_PASSWORD },
      {
        'x-requested-with': 'rento-web',
      },
    );
    expect(res.statusCode, res.body).toBe(200);
    const cookie = String(res.headers['set-cookie']).split(';')[0]!;
    admin = { email: boss.email, token: res.json<{ accessToken: string }>().accessToken, cookie };
    const me = await http('admin', 'GET', '/v1/admin/me');
    expect(me.json<{ superAdmin: boolean }>().superAdmin).toBe(true);

    // The session survives a "reload": the cookie alone buys a new access token.
    const again = await http(undefined, 'POST', '/v1/auth/session/refresh', undefined, {
      'x-requested-with': 'rento-web',
      cookie: admin.cookie,
    });
    expect(again.statusCode).toBe(200);
    admin.token = again.json<{ accessToken: string }>().accessToken;
    admin.cookie = String(again.headers['set-cookie']).split(';')[0]!;
    issued['admin'] = clock.now().getTime();
  });

  it('J-2 the owner sets up a drawer with two units of a product and uploads its photo', async () => {
    const drawer = await f.drawer({ name: 'Journey Hub' });
    for (let weekday = 1; weekday <= 7; weekday += 1) {
      await database.pool.query(
        `INSERT INTO drawer_hours (drawer_id, weekday, opens_at, closes_at) VALUES ($1, $2, '08:00', '22:00')`,
        [drawer.id, weekday],
      );
    }
    const model = await f.itemModel({
      name: 'Journey Console',
      slot_minutes: 30,
      min_duration_min: 30,
      max_duration_min: 240,
      price_per_slot_paise: 4900,
      buffer_min: 15,
      deposit_paise: 20000,
    });
    const a = await f.asset({
      drawer_id: drawer.id,
      item_model_id: model.id,
      asset_code: 'JRN-001',
    });
    const b = await f.asset({
      drawer_id: drawer.id,
      item_model_id: model.id,
      asset_code: 'JRN-002',
    });
    Object.assign(world, { drawerId: drawer.id, modelId: model.id, unitA: a.id, unitB: b.id });

    const photo = await app.app.inject({
      method: 'POST',
      url: `/v1/admin/item-models/${model.id}/photos`,
      headers: { authorization: `Bearer ${admin.token}`, 'content-type': 'image/png' },
      payload: PNG,
    });
    expect(photo.statusCode, photo.body).toBe(201);
    world['photo'] = photo.json<{ photos: string[] }>().photos[0]!;
  });

  it('J-3 a new customer registers, is stopped at booking until the identity is verified, then verifies with Aadhaar', async () => {
    const customer = await registerSession(app, clock, 'journey');
    customerToken = customer.accessToken;
    customerEmail = customer.email;
    world['customerId'] = customer.user.id;
    issued['customer'] = clock.now().getTime();

    const stopped = await http(
      'customer',
      'POST',
      '/v1/bookings',
      {
        drawerId: world['drawerId'],
        itemModelId: world['modelId'],
        startsAt: '2030-01-09T04:30:00Z',
        durationMinutes: 60,
      },
      { 'idempotency-key': 'journey-blocked-1' },
    );
    expect(stopped.statusCode).toBe(403);
    expect(stopped.json<{ code: string }>().code).toBe('KYC_REQUIRED');

    const number = aadhaarFrom('23456789012');
    const started = await http('customer', 'POST', '/v1/me/kyc/aadhaar', {
      aadhaarNumber: number,
    });
    expect(started.statusCode, started.body).toBe(200);
    const verified = await http('customer', 'POST', '/v1/me/kyc/aadhaar/verify', {
      requestId: started.json<{ requestId: string }>().requestId,
      otp: OTP,
    });
    expect(verified.statusCode, verified.body).toBe(200);
    expect(verified.json<{ status: string; maskedAadhaar: string }>()).toMatchObject({
      status: 'verified',
      maskedAadhaar: `XXXX XXXX ${number.slice(-4)}`,
    });
  });

  it('J-4 the customer finds the product with its photo, holds a slot and pays (demo gateway)', async () => {
    const catalogue = await http('customer', 'GET', `/v1/drawers/${world['drawerId']}/inventory`);
    const entry = catalogue
      .json<Array<{ itemModelId: string; photos: string[]; availableNow: number }>>()
      .find((e) => e.itemModelId === world['modelId']);
    expect(entry?.photos).toEqual([world['photo']]);
    expect((await app.app.inject({ method: 'GET', url: world['photo']! })).statusCode).toBe(200);

    const hold = await http(
      'customer',
      'POST',
      '/v1/bookings',
      {
        drawerId: world['drawerId'],
        itemModelId: world['modelId'],
        startsAt: '2030-01-07T04:30:00Z', // 10:00 IST today
        durationMinutes: 60,
      },
      { 'idempotency-key': 'journey-main-1' },
    );
    expect(hold.statusCode, hold.body).toBe(201);
    world['bookingId'] = hold.json<{ id: string }>().id;
    expect(hold.json<{ status: string }>().status).toBe('held');

    await http('customer', 'POST', `/v1/bookings/${world['bookingId']}/payment`);
    const checkout = await http(
      'customer',
      'POST',
      `/v1/bookings/${world['bookingId']}/payment/simulate`,
    );
    const paid = await http(
      'customer',
      'POST',
      `/v1/bookings/${world['bookingId']}/payment/confirm`,
      checkout.json(),
    );
    expect(paid.statusCode, paid.body).toBe(200);
    expect(paid.json<{ status: string }>().status).toBe('confirmed');
  });

  it('J-5 the admin panel shows the new booking everywhere: list, dashboard, schedule, customers, payments', async () => {
    const list = await http('admin', 'GET', '/v1/admin/bookings?status=confirmed');
    expect(list.json<{ items: Array<{ id: string }> }>().items.map((b) => b.id)).toContain(
      world['bookingId'],
    );

    const dash = await http('admin', 'GET', '/v1/admin/dashboard');
    expect(dash.json<{ now: { confirmed: number } }>().now.confirmed).toBeGreaterThanOrEqual(1);

    const schedule = await http(
      'admin',
      'GET',
      `/v1/admin/drawers/${world['drawerId']}/schedule?startsAt=2030-01-06T18:30:00Z&endsAt=2030-01-07T18:30:00Z`,
    );
    const seen = schedule
      .json<{ assets: Array<{ entries: Array<{ bookingId?: string }> }> }>()
      .assets.flatMap((a) => a.entries.map((e) => e.bookingId));
    expect(seen).toContain(world['bookingId']);

    const people = await http('admin', 'GET', `/v1/admin/customers?q=${customerEmail}`);
    expect(
      people.json<{ items: Array<{ kycStatus: string; bookingCount: number }> }>().items[0],
    ).toMatchObject({
      kycStatus: 'verified',
      bookingCount: 1,
    });

    const ledger = await http('admin', 'GET', `/v1/admin/payments?drawerId=${world['drawerId']}`);
    expect(
      ledger.json<{ items: Array<{ status: string; amountPaise: number }> }>().items[0],
    ).toMatchObject({
      status: 'captured',
      amountPaise: 29800,
    });
  });

  it('J-6 the owner moves the booking to the other unit; the customer sees nothing change but the schedule does', async () => {
    const before = await database.pool.query('SELECT asset_id FROM bookings WHERE id = $1', [
      world['bookingId'],
    ]);
    const res = await http('admin', 'POST', `/v1/admin/bookings/${world['bookingId']}/reassign`, {
      reason: 'Unit JRN-001 needs a clean',
    });
    expect(res.statusCode, res.body).toBe(200);
    const after = await database.pool.query('SELECT asset_id FROM bookings WHERE id = $1', [
      world['bookingId'],
    ]);
    expect(after.rows[0].asset_id).not.toBe(before.rows[0].asset_id);
    const mine = await http('customer', 'GET', `/v1/bookings/${world['bookingId']}`);
    expect(mine.json<{ status: string; startsAt: string }>()).toMatchObject({
      status: 'confirmed',
      startsAt: '2030-01-07T04:30:00.000Z',
    });
  });

  it('J-7 hand-over at the counter, an extension paid in the app, then the item comes back', async () => {
    clock.set('2030-01-07T04:30:00Z');
    const pickup = await http('admin', 'POST', `/v1/admin/bookings/${world['bookingId']}/pickup`);
    expect(pickup.statusCode, pickup.body).toBe(200);
    expect(
      (await http('customer', 'GET', `/v1/bookings/${world['bookingId']}`)).json<{
        status: string;
      }>().status,
    ).toBe('active');

    const ext = await http('customer', 'POST', `/v1/bookings/${world['bookingId']}/extend`, {
      extraMinutes: 30,
    });
    expect(ext.statusCode, ext.body).toBe(201);
    const extId = ext.json<{ id: string }>().id;
    const co = await http(
      'customer',
      'POST',
      `/v1/bookings/${world['bookingId']}/extensions/${extId}/simulate`,
    );
    const extended = await http(
      'customer',
      'POST',
      `/v1/bookings/${world['bookingId']}/extensions/${extId}/confirm`,
      co.json(),
    );
    expect(extended.statusCode, extended.body).toBe(200);
    expect(extended.json<{ durationMinutes: number }>().durationMinutes).toBe(90);

    clock.advance(90 * MIN);
    const back = await http('admin', 'POST', `/v1/admin/bookings/${world['bookingId']}/return`);
    expect(back.statusCode, back.body).toBe(200);
    expect(back.json<{ status: string }>().status).toBe('completed');
  });

  it('J-8 the reports add up the whole story, and the audit trail names who did what', async () => {
    const report = await http(
      'admin',
      'GET',
      `/v1/admin/reports/summary?from=2030-01-07T00:00:00Z&to=2030-01-08T00:00:00Z&drawerId=${world['drawerId']}`,
    );
    const totals = report.json<{ totals: Record<string, number> }>().totals;
    expect(totals).toMatchObject({ bookings: 1, completed: 1, rentedHours: 1.5 });
    expect(totals['collectedPaise']).toBe(29800 + 4900); // rental + deposit, then one 30-minute slot of extension
    expect(totals['netPaise']).toBe(29800 + 4900);

    const audit = await http('admin', 'GET', '/v1/admin/audit-logs?limit=100');
    const actions = audit.json<{ items: Array<{ action: string }> }>().items.map((a) => a.action);
    for (const expected of [
      'item_model.photo_added',
      'kyc.verified',
      'booking.reassigned',
      'booking.picked_up',
      'booking.returned',
    ]) {
      expect(actions, expected).toContain(expected);
    }
  });

  it('J-9 a second booking is cancelled: the customer is refunded and the ledger shows it', async () => {
    const hold = await http(
      'customer',
      'POST',
      '/v1/bookings',
      {
        drawerId: world['drawerId'],
        itemModelId: world['modelId'],
        startsAt: '2030-01-09T04:30:00Z',
        durationMinutes: 60,
      },
      { 'idempotency-key': 'journey-second-1' },
    );
    expect(hold.statusCode, hold.body).toBe(201);
    const id = hold.json<{ id: string }>().id;
    await http('customer', 'POST', `/v1/bookings/${id}/payment`);
    const co = await http('customer', 'POST', `/v1/bookings/${id}/payment/simulate`);
    await http('customer', 'POST', `/v1/bookings/${id}/payment/confirm`, co.json());
    const cancelled = await http('customer', 'POST', `/v1/bookings/${id}/cancel`);
    expect(cancelled.statusCode, cancelled.body).toBe(200);
    expect(cancelled.json<{ refund: { amountPaise: number } | null }>().refund?.amountPaise).toBe(
      29800,
    ); // ≥ 24 h ahead: all of it

    const ledger = await http(
      'admin',
      'GET',
      `/v1/admin/payments?status=refunded&drawerId=${world['drawerId']}`,
    );
    expect(
      ledger.json<{ items: Array<{ bookingId: string; refundedPaise: number }> }>().items,
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ bookingId: id, refundedPaise: 29800 })]),
    );
  });

  it('J-10 the owner suspends the customer: no new bookings, no sign-in; reinstating restores both', async () => {
    const suspend = await http(
      'admin',
      'POST',
      `/v1/admin/customers/${world['customerId']}/status`,
      {
        status: 'suspended',
        reason: 'Journey test',
      },
    );
    expect(suspend.statusCode, suspend.body).toBe(200);
    expect(
      (
        await http(undefined, 'POST', '/v1/auth/login', {
          email: customerEmail,
          password: TEST_PASSWORD,
        })
      ).statusCode,
    ).toBe(401);
    const blocked = await http(
      'customer',
      'POST',
      '/v1/bookings',
      {
        drawerId: world['drawerId'],
        itemModelId: world['modelId'],
        startsAt: '2030-01-10T04:30:00Z',
        durationMinutes: 60,
      },
      { 'idempotency-key': 'journey-suspended-1' },
    );
    expect(blocked.statusCode).toBe(403);

    await http('admin', 'POST', `/v1/admin/customers/${world['customerId']}/status`, {
      status: 'active',
      reason: 'Journey test over',
    });
    expect(
      (
        await http(undefined, 'POST', '/v1/auth/login', {
          email: customerEmail,
          password: TEST_PASSWORD,
        })
      ).statusCode,
    ).toBe(200);
  });

  it('J-11 signing out of the admin panel ends the browser session for good', async () => {
    const out = await http(undefined, 'POST', '/v1/auth/session/logout', undefined, {
      'x-requested-with': 'rento-web',
      cookie: admin.cookie,
    });
    expect(out.statusCode).toBe(204);
    const refresh = await http(undefined, 'POST', '/v1/auth/session/refresh', undefined, {
      'x-requested-with': 'rento-web',
      cookie: admin.cookie,
    });
    expect(refresh.statusCode).toBe(401);
  });
});

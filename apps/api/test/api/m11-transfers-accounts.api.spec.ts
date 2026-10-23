import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BookingJobs } from '../../src/modules/booking';
import { createFactories, type Factories } from '../factories';
import { grantPermissions, makeSuperAdmin } from '../support/access';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeClock } from '../support/fake-clock';
import {
  TEST_PASSWORD,
  type TestSession,
  freshSession,
  registerSession,
} from '../support/sessions';

const START = '2030-01-07T03:00:00Z'; // Monday 08:30 IST
const T10 = '2030-01-09T04:30:00Z';
const T12 = '2030-01-09T06:30:00Z';
const MIN = 60_000;

interface Problem {
  code: string;
}
interface Booking {
  id: string;
  status: string;
}
interface Checkout {
  orderId: string;
  paymentId: string;
  signature: string;
}
interface Transfer {
  id: string;
  assetId: string;
  fromDrawerId: string;
  toDrawerId: string;
  status: string;
}

let database: TestDatabase;
let app: TestApp;
let clock: FakeClock;
let f: Factories;
let jobs: BookingJobs;
let counter = 0;
let boss: TestSession;
let alice: TestSession;
let bob: TestSession;

beforeAll(async () => {
  database = await createTestDatabase();
  f = createFactories(database.db);
  clock = new FakeClock(START);
  app = await createTestApp({ config: testConfig({ DATABASE_URL: database.url }), clock });
  jobs = app.app.get(BookingJobs);
  boss = await registerSession(app, clock, 'x');
  alice = await registerSession(app, clock, 'x');
  bob = await registerSession(app, clock, 'x');
  await makeSuperAdmin(database.pool, boss.user.id);
});
afterAll(async () => {
  await app.app.close();
  await database.drop();
});

const call = async (
  who: TestSession | null,
  method: 'GET' | 'POST',
  url: string,
  payload?: Record<string, unknown>,
  headers: Record<string, string> = {},
) =>
  app.app.inject({
    method,
    url,
    headers: {
      ...(who && { authorization: `Bearer ${(await freshSession(app, clock, who)).accessToken}` }),
      ...headers,
    },
    ...(payload !== undefined && { payload }),
  });

async function drawerWithHours() {
  const drawer = await f.drawer();
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    await database.pool.query(
      `INSERT INTO drawer_hours (drawer_id, weekday, opens_at, closes_at) VALUES ($1, $2, '08:00', '22:00')`,
      [drawer.id, weekday],
    );
  }
  return drawer.id;
}
interface World {
  drawerId: string;
  modelId: string;
  assetId: string;
}
/** A drawer with one unit of a fresh model. */
async function world(): Promise<World> {
  const drawerId = await drawerWithHours();
  const model = await f.itemModel({
    slot_minutes: 30,
    min_duration_min: 30,
    max_duration_min: 240,
    price_per_slot_paise: 4900,
    buffer_min: 15,
    deposit_paise: 20000,
  });
  const asset = await f.asset({
    drawer_id: drawerId,
    item_model_id: model.id,
    asset_code: `T-${(counter += 1)}`,
  });
  return { drawerId, modelId: model.id, assetId: asset.id };
}
const book = (
  who: TestSession,
  drawerId: string,
  modelId: string,
  startsAt: string,
  minutes = 60,
) =>
  call(
    who,
    'POST',
    '/v1/bookings',
    { drawerId, itemModelId: modelId, startsAt, durationMinutes: minutes },
    { 'idempotency-key': `k-${(counter += 1)}-${Date.now()}` },
  );
async function confirmed(who: TestSession, drawerId: string, modelId: string, startsAt = T10) {
  const held = (await book(who, drawerId, modelId, startsAt)).json<Booking>();
  await call(who, 'POST', `/v1/bookings/${held.id}/payment`);
  const checkout = (
    await call(who, 'POST', `/v1/bookings/${held.id}/payment/simulate`)
  ).json<Checkout>();
  const res = await call(who, 'POST', `/v1/bookings/${held.id}/payment/confirm`, checkout as never);
  expect(res.statusCode, res.body).toBe(200);
  return res.json<Booking>();
}
const transfer = (
  assetId: string,
  toDrawerId: string,
  who: TestSession | null = boss,
  reason = 'Demand moved',
) => call(who, 'POST', `/v1/admin/assets/${assetId}/transfer`, { toDrawerId, reason });
const finish = (assetId: string, how: 'complete' | 'cancel', who: TestSession | null = boss) =>
  call(who, 'POST', `/v1/admin/assets/${assetId}/transfer/${how}`);
const assetRow = async (id: string) =>
  (await database.pool.query('SELECT drawer_id, status FROM assets WHERE id = $1', [id]))
    .rows[0] as {
    drawer_id: string;
    status: string;
  };
const audits = async (action: string, entityId: string) =>
  (
    await database.pool.query(
      'SELECT reason FROM audit_logs WHERE action = $1 AND entity_id = $2',
      [action, entityId],
    )
  ).rows;

describe('asset transfers between drawers', () => {
  it('T-1 start → in transfer and unbookable; complete → belongs to the other drawer and is bookable there', async () => {
    const w = await world();
    const dest = await drawerWithHours();
    const started = await transfer(w.assetId, dest);
    expect(started.statusCode, started.body).toBe(201);
    const t = started.json<Transfer>();
    expect(t).toMatchObject({ status: 'in_transit', fromDrawerId: w.drawerId, toDrawerId: dest });
    expect(await assetRow(w.assetId)).toEqual({ drawer_id: w.drawerId, status: 'in_transfer' });
    expect((await book(alice, w.drawerId, w.modelId, T10)).statusCode).toBe(409); // out of service
    expect(
      (await call(boss, 'GET', `/v1/admin/assets/${w.assetId}/transfer`)).json<Transfer>().id,
    ).toBe(t.id);

    const done = await finish(w.assetId, 'complete');
    expect(done.statusCode, done.body).toBe(200);
    expect(done.json<Transfer>().status).toBe('completed');
    expect(await assetRow(w.assetId)).toEqual({ drawer_id: dest, status: 'available' });
    expect((await book(alice, dest, w.modelId, T10)).statusCode).toBe(201); // bookable at the new drawer
    expect((await book(bob, w.drawerId, w.modelId, T10)).statusCode).toBe(404); // no longer offered at the old drawer
    expect((await call(boss, 'GET', `/v1/admin/assets/${w.assetId}/transfer`)).body).toBe('null');
    expect(await audits('asset.transfer_started', w.assetId)).toEqual([{ reason: 'Demand moved' }]);
    expect(await audits('asset.transfer_completed', w.assetId)).toHaveLength(1);
  });

  it('T-2 cancelling leaves the asset where it was and bookable', async () => {
    const w = await world();
    const dest = await drawerWithHours();
    await transfer(w.assetId, dest);
    const res = await finish(w.assetId, 'cancel');
    expect(res.json<Transfer>().status).toBe('cancelled');
    expect(await assetRow(w.assetId)).toEqual({ drawer_id: w.drawerId, status: 'available' });
    expect((await book(alice, w.drawerId, w.modelId, T10)).statusCode).toBe(201);
    expect(await audits('asset.transfer_cancelled', w.assetId)).toHaveLength(1);
  });

  it('T-3 upcoming bookings or blocks stop a transfer; nothing is cancelled for the staff', async () => {
    const w = await world();
    const dest = await drawerWithHours();
    const b = await confirmed(alice, w.drawerId, w.modelId, T10);
    const refused = await transfer(w.assetId, dest);
    expect(refused.statusCode).toBe(409);
    expect(refused.json<Problem>().code).toBe('HAS_FUTURE_BOOKINGS');
    expect(await assetRow(w.assetId)).toEqual({ drawer_id: w.drawerId, status: 'available' });
    expect(
      (await database.pool.query('SELECT status FROM bookings WHERE id = $1', [b.id])).rows[0]
        .status,
    ).toBe('confirmed');

    await call(alice, 'POST', `/v1/bookings/${b.id}/cancel`);
    expect(
      (
        await call(boss, 'POST', `/v1/admin/assets/${w.assetId}/blocks`, {
          startsAt: T10,
          endsAt: T12,
          reason: 'Service',
        })
      ).statusCode,
    ).toBe(201);
    expect((await transfer(w.assetId, dest)).statusCode).toBe(409);
  });

  it('T-4 input and state rules', async () => {
    const w = await world();
    const dest = await drawerWithHours();
    expect((await transfer(w.assetId, w.drawerId)).statusCode).toBe(422);
    expect((await transfer(w.assetId, '00000000-0000-4000-8000-000000000000')).statusCode).toBe(
      422,
    );
    expect((await transfer(w.assetId, 'nope')).statusCode).toBe(422);
    expect((await transfer(w.assetId, dest, boss, 'x')).statusCode).toBe(422);
    expect((await finish(w.assetId, 'complete')).statusCode).toBe(409); // nothing to complete
    expect((await finish(w.assetId, 'cancel')).json<Problem>().code).toBe('INVALID_STATE');

    await database.pool.query(`UPDATE assets SET status = 'maintenance' WHERE id = $1`, [
      w.assetId,
    ]);
    expect((await transfer(w.assetId, dest)).json<Problem>().code).toBe('IN_USE');
    await database.pool.query(`UPDATE assets SET status = 'available' WHERE id = $1`, [w.assetId]);

    expect((await transfer(w.assetId, dest)).statusCode).toBe(201);
    expect((await transfer(w.assetId, dest)).statusCode).toBe(409); // already on its way
    expect((await transfer('00000000-0000-4000-8000-000000000000', dest)).statusCode).toBe(404);
    // The asset cannot be pushed into another state by the ordinary edit.
    expect(
      (await call(boss, 'POST', `/v1/admin/assets/${w.assetId}/transfer/complete`)).statusCode,
    ).toBe(200);
    const again = await finish(w.assetId, 'complete');
    expect(again.statusCode).toBe(409);
  });

  it('T-5 permissions and drawer scope', async () => {
    const w = await world();
    const dest = await drawerWithHours();
    const elsewhere = await drawerWithHours();
    const writer = await registerSession(app, clock, 'x');
    await grantPermissions(database.pool, writer.user.id, ['assets:write', 'assets:read']);
    const fromOnly = await registerSession(app, clock, 'x');
    await grantPermissions(database.pool, fromOnly.user.id, ['assets:transfer'], w.drawerId);
    const toOnly = await registerSession(app, clock, 'x');
    await grantPermissions(database.pool, toOnly.user.id, ['assets:transfer'], dest);
    const stranger = await registerSession(app, clock, 'x');
    await grantPermissions(database.pool, stranger.user.id, ['assets:transfer'], elsewhere);

    expect((await transfer(w.assetId, dest, null)).statusCode).toBe(401);
    expect((await transfer(w.assetId, dest, alice)).statusCode).toBe(403);
    expect((await transfer(w.assetId, dest, writer)).statusCode).toBe(403);
    expect((await transfer(w.assetId, dest, stranger)).statusCode).toBe(404);
    expect((await transfer(w.assetId, dest, toOnly)).statusCode).toBe(404); // not their drawer's asset
    expect((await transfer(w.assetId, dest, fromOnly)).statusCode).toBe(403); // no right to the destination

    expect((await transfer(w.assetId, dest, boss)).statusCode).toBe(201);
    expect((await call(stranger, 'GET', `/v1/admin/assets/${w.assetId}/transfer`)).statusCode).toBe(
      404,
    );
    expect((await finish(w.assetId, 'complete', stranger)).statusCode).toBe(404);
    expect((await finish(w.assetId, 'complete', fromOnly)).statusCode).toBe(403); // cannot receive what is not theirs
    expect((await finish(w.assetId, 'complete', toOnly)).statusCode).toBe(200); // the receiving side can
    expect(await assetRow(w.assetId)).toEqual({ drawer_id: dest, status: 'available' });
  });

  it('T-6 a transfer racing a booking for the only unit: exactly one wins, never both', async () => {
    for (let round = 0; round < 6; round += 1) {
      const w = await world();
      const dest = await drawerWithHours();
      const [booked, moved] = await Promise.all([
        book(alice, w.drawerId, w.modelId, T10),
        transfer(w.assetId, dest),
      ]);
      expect([booked.statusCode, moved.statusCode].filter((s) => s === 201)).toHaveLength(1);
      expect([booked.statusCode, moved.statusCode].filter((s) => s === 409)).toHaveLength(1);
      const row = await assetRow(w.assetId);
      if (moved.statusCode === 201) expect(row.status).toBe('in_transfer');
      else expect(row.status).toBe('available');
    }
  });
});

describe('suspending a customer', () => {
  const login = async (email: string) =>
    app.app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password: TEST_PASSWORD },
    });
  const setStatus = (
    who: TestSession | null,
    id: string,
    status: string,
    reason = 'Abusive behaviour',
  ) => call(who, 'POST', `/v1/admin/customers/${id}/status`, { status, reason });

  it('S-1 a suspended customer is signed out everywhere, cannot sign in or book; reinstating restores it all', async () => {
    const w = await world();
    const carol = await registerSession(app, clock, 'x');
    const first = (await login(carol.email)).json<{ refreshToken: string; accessToken: string }>();
    expect((await book(carol, w.drawerId, w.modelId, T10)).statusCode).toBe(201);

    const res = await setStatus(boss, carol.user.id, 'suspended');
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json<{ accountStatus: string }>().accountStatus).toBe('suspended');

    expect((await login(carol.email)).statusCode).toBe(401);
    const refreshed = await app.app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: first.refreshToken },
    });
    expect(refreshed.statusCode).toBe(401);
    // Even an access token that is still valid cannot start a booking.
    const blocked = await app.app.inject({
      method: 'POST',
      url: '/v1/bookings',
      headers: {
        authorization: `Bearer ${first.accessToken}`,
        'idempotency-key': `s-${Date.now()}`,
      },
      payload: { drawerId: w.drawerId, itemModelId: w.modelId, startsAt: T12, durationMinutes: 60 },
    });
    expect(blocked.statusCode).toBe(403);
    expect(await audits('customer.suspended', carol.user.id)).toEqual([
      { reason: 'Abusive behaviour' },
    ]);

    expect(
      (await setStatus(boss, carol.user.id, 'active', 'Resolved with the customer')).statusCode,
    ).toBe(200);
    expect((await login(carol.email)).statusCode).toBe(200);
    const w2 = await world();
    expect((await book(carol, w2.drawerId, w2.modelId, T10)).statusCode).toBe(201);
    expect(await audits('customer.reinstated', carol.user.id)).toHaveLength(1);
  });

  it('S-2 the list and detail show the account state; repeating a decision changes nothing', async () => {
    const dave = await registerSession(app, clock, 'x');
    await setStatus(boss, dave.user.id, 'suspended');
    await setStatus(boss, dave.user.id, 'suspended');
    expect(await audits('customer.suspended', dave.user.id)).toHaveLength(1);
    const detail = (await call(boss, 'GET', `/v1/admin/customers/${dave.user.id}`)).json<{
      accountStatus: string;
    }>();
    expect(detail.accountStatus).toBe('suspended');
    const list = (await call(boss, 'GET', `/v1/admin/customers?q=${dave.email}`)).json<{
      items: Array<{ id: string; accountStatus: string }>;
    }>();
    expect(list.items.find((c) => c.id === dave.user.id)?.accountStatus).toBe('suspended');
  });

  it('S-3 staff cannot be suspended here; bad input and permissions', async () => {
    const reader = await registerSession(app, clock, 'x');
    await grantPermissions(database.pool, reader.user.id, ['users:read']);
    const scoped = await registerSession(app, clock, 'x');
    const d = await drawerWithHours();
    await grantPermissions(database.pool, scoped.user.id, ['users:read', 'users:write'], d);
    const target = await registerSession(app, clock, 'x');

    expect((await setStatus(boss, boss.user.id, 'suspended')).json<Problem>().code).toBe(
      'INVALID_STATE',
    );
    expect(
      (await setStatus(boss, '00000000-0000-4000-8000-000000000000', 'suspended')).statusCode,
    ).toBe(404);
    expect((await setStatus(boss, 'nope', 'suspended')).statusCode).toBe(404);
    expect((await setStatus(boss, target.user.id, 'deleted')).statusCode).toBe(422);
    expect((await setStatus(boss, target.user.id, 'suspended', 'x')).statusCode).toBe(422);
    expect((await setStatus(null, target.user.id, 'suspended')).statusCode).toBe(401);
    expect((await setStatus(alice, target.user.id, 'suspended')).statusCode).toBe(403);
    expect((await setStatus(reader, target.user.id, 'suspended')).statusCode).toBe(403);
    expect((await setStatus(scoped, target.user.id, 'suspended')).statusCode).toBe(403); // drawer-limited grant
    expect(
      (await database.pool.query('SELECT status FROM users WHERE id = $1', [target.user.id]))
        .rows[0].status,
    ).toBe('active');
  });
});

describe('booking reminders', () => {
  const remindersFor = (email: string) => app.mail.find(email, 'starts soon');

  it('E-1 one reminder email shortly before a confirmed booking starts — not earlier, not twice, not if cancelled', async () => {
    clock.set(START);
    const w = await world();
    const start = new Date(Date.parse(START) + 3 * 60 * MIN).toISOString(); // 3 h ahead
    const b = await confirmed(bob, w.drawerId, w.modelId, start);

    expect((await jobs.runOnce()).remindersQueued).toBe(0); // too early
    clock.advance(2 * 60 * MIN + 30 * MIN); // 30 min before
    const report = await jobs.runOnce();
    expect(report.remindersQueued).toBeGreaterThanOrEqual(1);
    const mails = remindersFor(bob.email);
    expect(mails).toHaveLength(1);
    expect(mails[0]!.purpose).toBe('booking_reminder');
    expect(mails[0]!.text).toContain('11:30 am'); // 06:00Z in Asia/Kolkata
    expect((await jobs.runOnce()).remindersQueued).toBe(0); // not twice
    expect(remindersFor(bob.email)).toHaveLength(1);
    expect(
      (await database.pool.query('SELECT reminder_sent_at FROM bookings WHERE id = $1', [b.id]))
        .rows[0].reminder_sent_at,
    ).not.toBeNull();
    clock.set(START);
  });

  it('E-2 a booking cancelled before the reminder time gets none', async () => {
    clock.set(START);
    const w = await world();
    const start = new Date(Date.parse(START) + 3 * 60 * MIN).toISOString();
    const b = await confirmed(alice, w.drawerId, w.modelId, start);
    await call(alice, 'POST', `/v1/bookings/${b.id}/cancel`);
    clock.advance(2 * 60 * MIN + 30 * MIN);
    await jobs.runOnce();
    expect(
      remindersFor(alice.email).filter((m) => m.text.includes(String(w.modelId))),
    ).toHaveLength(0);
    const row = await database.pool.query('SELECT reminder_sent_at FROM bookings WHERE id = $1', [
      b.id,
    ]);
    expect(row.rows[0].reminder_sent_at).toBeNull();
    clock.set(START);
  });
});

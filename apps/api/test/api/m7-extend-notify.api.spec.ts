import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BookingJobs } from '../../src/modules/booking';
import { createFactories, type Factories } from '../factories';
import { makeSuperAdmin } from '../support/access';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeClock } from '../support/fake-clock';
import { type TestSession, freshSession, registerSession } from '../support/sessions';

const START = '2030-01-07T03:00:00Z'; // Monday 08:30 IST
const T10 = '2030-01-07T04:30:00Z'; // 10:00 IST
const MIN = 60_000;

interface Problem {
  code: string;
  errors?: Array<{ field: string; message: string }>;
}
interface Booking {
  id: string;
  status: string;
  endsAt: string;
  pricePaise: number;
  durationMinutes: number;
}
interface Extension {
  id: string;
  pricePaise: number;
  newEndsAt: string;
  orderId: string;
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
  who: TestSession | undefined,
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

interface World {
  drawerId: string;
  modelId: string;
}
async function world(o: { closes?: string; max?: number } = {}): Promise<World> {
  const drawer = await f.drawer();
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    await database.pool.query(
      `INSERT INTO drawer_hours (drawer_id, weekday, opens_at, closes_at) VALUES ($1, $2, '08:00', $3)`,
      [drawer.id, weekday, o.closes ?? '22:00'],
    );
  }
  const model = await f.itemModel({
    slot_minutes: 30,
    min_duration_min: 30,
    max_duration_min: o.max ?? 240,
    price_per_slot_paise: 4900,
    buffer_min: 15,
    deposit_paise: 20000,
  });
  await f.asset({
    drawer_id: drawer.id,
    item_model_id: model.id,
    asset_code: `X-${(counter += 1)}`,
  });
  return { drawerId: drawer.id, modelId: model.id };
}
const book = (who: TestSession, w: World, startsAt: string, minutes: number) =>
  call(
    who,
    'POST',
    '/v1/bookings',
    { drawerId: w.drawerId, itemModelId: w.modelId, startsAt, durationMinutes: minutes },
    { 'idempotency-key': `k-${(counter += 1)}-${Date.now()}` },
  );
async function confirmed(
  who: TestSession,
  w: World,
  startsAt = T10,
  minutes = 60,
): Promise<Booking> {
  const held = (await book(who, w, startsAt, minutes)).json<Booking>();
  await call(who, 'POST', `/v1/bookings/${held.id}/payment`);
  const checkout = (
    await call(who, 'POST', `/v1/bookings/${held.id}/payment/simulate`)
  ).json<Checkout>();
  const res = await call(who, 'POST', `/v1/bookings/${held.id}/payment/confirm`, checkout as never);
  expect(res.statusCode, res.body).toBe(200);
  return res.json<Booking>();
}
/** A rental that is running: confirmed, then handed over at its start. */
async function active(who: TestSession, w: World, startsAt = T10, minutes = 60): Promise<Booking> {
  const b = await confirmed(who, w, startsAt, minutes);
  clock.set(startsAt);
  const res = await call(boss, 'POST', `/v1/admin/bookings/${b.id}/pickup`);
  expect(res.statusCode, res.body).toBe(200);
  return res.json<Booking>();
}
const extend = (who: TestSession, id: string, extraMinutes: number) =>
  call(who, 'POST', `/v1/bookings/${id}/extend`, { extraMinutes });
async function payExtension(who: TestSession, bookingId: string, ext: Extension) {
  const checkout = (
    await call(who, 'POST', `/v1/bookings/${bookingId}/extensions/${ext.id}/simulate`)
  ).json<Checkout>();
  return call(
    who,
    'POST',
    `/v1/bookings/${bookingId}/extensions/${ext.id}/confirm`,
    checkout as never,
  );
}
const one = async (sql: string, args: unknown[] = []) =>
  (await database.pool.query(sql, args)).rows[0];

describe('extending a running rental', () => {
  it('X-1 only a running rental of yours can be extended', async () => {
    clock.set(START);
    const w = await world();
    const b = await confirmed(alice, w);
    const notYet = await extend(alice, b.id, 30);
    expect(notYet.statusCode).toBe(409);
    expect(notYet.json<Problem>().code).toBe('INVALID_STATE');
    clock.set(T10);
    await call(boss, 'POST', `/v1/admin/bookings/${b.id}/pickup`);
    expect((await extend(bob, b.id, 30)).statusCode).toBe(404);
    expect((await extend(undefined as never, b.id, 30)).statusCode).toBe(401);
  });

  it('X-2 pay for the extra time ⇒ the rental ends later, costs more and keeps the unit; repeating changes nothing', async () => {
    clock.set(START);
    const w = await world();
    const b = await active(alice, w);
    const started = await extend(alice, b.id, 30);
    expect(started.statusCode, started.body).toBe(201);
    const ext = started.json<Extension>();
    expect(ext).toMatchObject({ pricePaise: 4900, newEndsAt: '2030-01-07T06:00:00.000Z' });
    // nothing is blocked or charged before payment
    expect((await call(alice, 'GET', `/v1/bookings/${b.id}`)).json<Booking>().endsAt).toBe(
      b.endsAt,
    );

    const done = await payExtension(alice, b.id, ext);
    expect(done.statusCode, done.body).toBe(200);
    expect(done.json<Booking>()).toMatchObject({
      status: 'active',
      endsAt: '2030-01-07T06:00:00.000Z',
      pricePaise: 9800 + 4900,
      durationMinutes: 90,
    });
    const occ = await one(
      `SELECT upper(during) AS u FROM asset_occupancies WHERE booking_id = $1 AND released_at IS NULL`,
      [b.id],
    );
    expect(new Date(occ.u).toISOString()).toBe('2030-01-07T06:15:00.000Z'); // + 15 min buffer
    expect(
      (await one(`SELECT status FROM payments WHERE extension_id = $1`, [ext.id])).status,
    ).toBe('captured');
    expect(
      (
        await one(
          `SELECT note FROM booking_events WHERE booking_id = $1 AND note LIKE 'Extended%'`,
          [b.id],
        )
      ).note,
    ).toBe('Extended by 30 minutes');

    const checkout = await call(
      alice,
      'POST',
      `/v1/bookings/${b.id}/extensions/${ext.id}/simulate`,
    );
    expect(checkout.statusCode).toBe(409); // already paid: nothing left to pay
    expect(
      (await one(`SELECT count(*)::int AS n FROM booking_events WHERE booking_id = $1`, [b.id])).n,
    ).toBe(4); // held, confirmed, active, extended
  });

  it('X-3 the length must be a whole number of slots', async () => {
    clock.set(START);
    const w = await world();
    const b = await active(alice, w);
    for (const bad of [0, -30, 45, 29]) {
      expect((await extend(alice, b.id, bad)).statusCode, String(bad)).toBe(422);
    }
    expect(
      await one(`SELECT count(*)::int AS n FROM booking_extensions WHERE booking_id = $1`, [b.id]),
    ).toEqual({ n: 0 });
  });

  it('X-4 the next booking limits the extension: refused with how many minutes are possible', async () => {
    clock.set(START);
    const w = await world();
    const b = await active(alice, w); // 10:00–11:00, blocked until 11:15
    clock.set(START);
    // next customer books 12:00–13:00 IST (06:30Z): free time after our buffer is 11:15–11:45 ⇒ 30 minutes
    expect((await book(bob, w, '2030-01-07T06:30:00Z', 60)).statusCode).toBe(201);
    clock.set(T10);
    const refused = await extend(alice, b.id, 60);
    expect(refused.statusCode).toBe(409);
    expect(refused.json<Problem>().code).toBe('EXTENSION_UNAVAILABLE');
    expect(refused.json<Problem>().errors?.[0]?.message).toBe('at most 30 minutes');
    expect((await extend(alice, b.id, 30)).statusCode).toBe(201);
  });

  it('X-5 someone books the gap while the extension is being paid ⇒ 409, NOTHING is charged, the rental is unchanged', async () => {
    clock.set(START);
    const w = await world();
    const b = await active(alice, w);
    const ext = (await extend(alice, b.id, 60)).json<Extension>();
    clock.set(START);
    expect((await book(bob, w, '2030-01-07T05:45:00Z', 30)).statusCode).toBe(201); // right after our buffer
    clock.set(T10);
    const res = await payExtension(alice, b.id, ext);
    expect(res.statusCode).toBe(409);
    expect(res.json<Problem>().code).toBe('EXTENSION_UNAVAILABLE');
    expect(
      (await one(`SELECT status FROM payments WHERE extension_id = $1`, [ext.id])).status,
    ).toBe('created');
    expect((await call(alice, 'GET', `/v1/bookings/${b.id}`)).json<Booking>()).toMatchObject({
      endsAt: b.endsAt,
      pricePaise: 9800,
    });
  });

  it('X-6 a tampered payment does not extend; another customer cannot confirm', async () => {
    clock.set(START);
    const w = await world();
    const b = await active(alice, w);
    const ext = (await extend(alice, b.id, 30)).json<Extension>();
    const real = (
      await call(alice, 'POST', `/v1/bookings/${b.id}/extensions/${ext.id}/simulate`)
    ).json<Checkout>();
    for (const payload of [
      { ...real, signature: 'deadbeef' },
      { ...real, orderId: 'fake_order_x' },
    ]) {
      const res = await call(
        alice,
        'POST',
        `/v1/bookings/${b.id}/extensions/${ext.id}/confirm`,
        payload,
      );
      expect(res.statusCode).toBe(422);
      expect(res.json<Problem>().code).toBe('PAYMENT_INVALID');
    }
    expect(
      (await call(bob, 'POST', `/v1/bookings/${b.id}/extensions/${ext.id}/confirm`, real as never))
        .statusCode,
    ).toBe(404);
    expect((await call(alice, 'GET', `/v1/bookings/${b.id}`)).json<Booking>().endsAt).toBe(
      b.endsAt,
    );
  });

  it("X-7 closing time and the model's maximum length cap the extension", async () => {
    clock.set(START);
    const early = await world({ closes: '11:30' }); // closes 11:30 IST: only 30 minutes after an 11:00 end
    const b = await active(alice, early);
    expect((await extend(alice, b.id, 60)).statusCode).toBe(409);
    expect((await extend(alice, b.id, 30)).statusCode).toBe(201);

    clock.set(START);
    const capped = await world({ max: 90 });
    const c = await active(bob, capped); // 60 min already, maximum 90 ⇒ 30 more at most
    expect((await extend(bob, c.id, 60)).json<Problem>().code).toBe('EXTENSION_UNAVAILABLE');
    expect((await extend(bob, c.id, 30)).statusCode).toBe(201);
  });
});

describe('booking emails (outbox)', () => {
  const modelName = async (w: World) =>
    (await one('SELECT name FROM item_models WHERE id = $1', [w.modelId])).name as string;
  /** Mails of this customer about this item model only (other tests share the customers). */
  const find = async (email: string, part: string, w: World) => {
    const name = await modelName(w);
    return app.mail.find(email, part).filter((m) => m.text.includes(name));
  };
  const emailOf = async (s: TestSession) => s.email;

  it("N-1 confirmation and cancellation mails go to the customer, with the time in the drawer's zone and the refund", async () => {
    clock.set(START);
    const w = await world();
    const b = await confirmed(alice, w, '2030-01-09T04:30:00Z', 60);
    await jobs.runOnce();
    const mail = await find(await emailOf(alice), 'Booked', w);
    expect(mail).toHaveLength(1);
    expect(mail[0]!.purpose).toBe('booking_confirmed');
    expect(mail[0]!.text).toContain('10:00 am'); // 04:30Z in Asia/Kolkata
    expect(mail[0]!.text).toContain('₹298');

    expect((await call(alice, 'POST', `/v1/bookings/${b.id}/cancel`)).statusCode).toBe(200);
    await jobs.runOnce();
    const cancelled = await find(await emailOf(alice), 'Cancelled', w);
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0]!.text).toContain('Refund: ₹298');
    await jobs.runOnce();
    expect(await find(await emailOf(alice), 'Cancelled', w)).toHaveLength(1); // delivered once
  });

  it('N-2 an expired hold tells the customer they were not charged', async () => {
    clock.set(START);
    const w = await world();
    await book(bob, w, T10, 60);
    clock.advance(11 * MIN);
    await jobs.runOnce();
    const mail = await find(await emailOf(bob), 'ran out', w);
    expect(mail).toHaveLength(1);
    expect(mail[0]!.text).toContain('not charged');
  });

  it('N-3 a failing mail server never affects the booking; the mail is retried later', async () => {
    clock.set(START);
    const w = await world();
    app.mail.failWith = new Error('smtp down');
    const b = await confirmed(alice, w, '2030-01-11T04:30:00Z', 60);
    await jobs.runOnce();
    expect(await find(await emailOf(alice), 'Booked', w)).toHaveLength(0); // the mail server was down
    expect((await call(alice, 'GET', `/v1/bookings/${b.id}`)).json<Booking>().status).toBe(
      'confirmed',
    );
    app.mail.failWith = undefined;
    clock.advance(31_000);
    await jobs.runOnce();
    expect(app.mail.sent.length).toBeGreaterThan(0);
    expect(await find(await emailOf(alice), 'Booked', w)).toHaveLength(1);
  });

  it('N-4 the mail contains no tokens and escapes what customers wrote', async () => {
    clock.set(START);
    await database.pool.query(`UPDATE users SET display_name = $1 WHERE id = $2`, [
      '<b>Eve</b>',
      alice.user.id,
    ]);
    const w = await world();
    await confirmed(alice, w, '2030-01-12T04:30:00Z', 60);
    await jobs.runOnce();
    const last = (await find(await emailOf(alice), 'Booked', w)).at(-1)!;
    expect(last.html).toContain('&#60;b&#62;Eve');
    expect(last.html).not.toContain('<b>Eve');
    expect(last.text + last.html).not.toMatch(/eyJ|refresh|signature/i);
  });
});

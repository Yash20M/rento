import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { requestHash } from '../../src/common/idempotency/idempotency.service';
import { BookingJobs, OutboxDispatcher } from '../../src/modules/booking';
import { createFactories, type Factories } from '../factories';
import { grantPermissions, makeSuperAdmin } from '../support/access';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeClock } from '../support/fake-clock';

const PASSWORD = 'correct horse battery staple';
const START = '2030-01-07T03:00:00Z'; // Monday 08:30 in Asia/Kolkata
const MIN = 60_000;

interface Session {
  accessToken: string;
  user: { id: string };
  /** Test bookkeeping: how to sign in again, and at which fake-clock instant the token was issued. */
  email: string;
  issuedAt: number;
}
interface Problem {
  code: string;
  detail?: string;
  errors?: Array<{ field: string; message: string }>;
}
interface Booking {
  id: string;
  status: string;
  assetCode: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  pricePaise: number;
  depositPaise: number;
  totalPaise: number;
  holdExpiresAt: string | null;
  cancellable: boolean;
  cancelReason: string | null;
  drawer: { id: string; name: string; timezone: string };
  itemModel: { id: string; name: string };
  payment: { status: string; orderId: string; amountPaise: number } | null;
  refund: { amountPaise: number; status: string } | null;
}
interface AdminBooking extends Booking {
  customer: { id: string; email: string | null };
}
interface AdminDetail extends AdminBooking {
  history: Array<{
    from: string | null;
    to: string;
    actorUserId: string | null;
    note: string | null;
  }>;
}
interface Page {
  items: AdminBooking[];
  nextCursor: string | null;
}
interface Order {
  orderId: string;
  amountPaise: number;
  provider: string;
  holdExpiresAt: string | null;
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
let boss: Session;
let alice: Session;
let bob: Session;
let carol: Session;

beforeAll(async () => {
  database = await createTestDatabase();
  f = createFactories(database.db);
  clock = new FakeClock(START);
  app = await createTestApp({ config: testConfig({ DATABASE_URL: database.url }), clock });
  jobs = app.app.get(BookingJobs);
  boss = await register();
  alice = await register();
  bob = await register();
  carol = await register();
  await makeSuperAdmin(database.pool, boss.user.id);
});
afterAll(async () => {
  await app.app.close();
  await database.drop();
});
beforeEach(() => clock.set(START));
afterEach(async () => {
  // Whatever a test did, the ledger and the bookings must agree.
  const bad = await database.pool.query(`
    SELECT b.id, b.status FROM bookings b
     WHERE b.status IN ('held','confirmed','active','overdue')
       AND (SELECT count(*) FROM asset_occupancies o WHERE o.booking_id = b.id AND o.released_at IS NULL) <> 1
    UNION ALL
    SELECT b.id, b.status FROM bookings b
      JOIN asset_occupancies o ON o.booking_id = b.id AND o.released_at IS NULL
     WHERE b.status IN ('cancelled','expired','no_show')`);
  expect(bad.rows, 'bookings and occupancies disagree').toEqual([]);
});

async function register(): Promise<Session> {
  const email = `m3-${(counter += 1)}-${Date.now()}@example.com`;
  const res = await app.app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email, password: PASSWORD, name: 'Tester' },
  });
  return { ...res.json<Session>(), email, issuedAt: clock.now().getTime() };
}

/** Access tokens follow the fake clock, which these tests move by hours: sign in again whenever it has moved. */
async function fresh(who: Session): Promise<Session> {
  const now = clock.now().getTime();
  if (Math.abs(now - who.issuedAt) <= 5 * MIN) return who;
  const res = await app.app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email: who.email, password: PASSWORD },
  });
  who.accessToken = res.json<Session>().accessToken;
  who.issuedAt = now;
  return who;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';
const call = async (
  who: Session | undefined,
  method: Method,
  url: string,
  payload?: Record<string, unknown>,
  headers: Record<string, string> = {},
) =>
  app.app.inject({
    method,
    url,
    headers: {
      ...(who && { authorization: `Bearer ${(await fresh(who)).accessToken}` }),
      ...headers,
    },
    ...(payload !== undefined && { payload }),
  });

interface World {
  drawerId: string;
  modelId: string;
  assetIds: string[];
}
/** A drawer open 08:00–22:00 IST every day, one item model and `assets` units of it. */
async function world(
  o: { assets?: number; buffer?: number; deposit?: number; drawer?: Record<string, unknown> } = {},
): Promise<World> {
  const drawer = await f.drawer(o.drawer);
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    await database.pool.query(
      `INSERT INTO drawer_hours (drawer_id, weekday, opens_at, closes_at) VALUES ($1, $2, '08:00', '22:00')`,
      [drawer.id, weekday],
    );
  }
  const model = await f.itemModel({
    slot_minutes: 30,
    min_duration_min: 30,
    max_duration_min: 240,
    price_per_slot_paise: 4900,
    buffer_min: o.buffer ?? 15,
    deposit_paise: o.deposit ?? 20000,
  });
  const assetIds: string[] = [];
  for (let i = 1; i <= (o.assets ?? 1); i += 1) {
    const asset = await f.asset({
      drawer_id: drawer.id,
      item_model_id: model.id,
      asset_code: `M3-${(counter += 1)}-${i}`,
    });
    assetIds.push(asset.id);
  }
  return { drawerId: drawer.id, modelId: model.id, assetIds };
}

// 10:00 IST on Monday 2030-01-07 and some neighbours
const T10 = '2030-01-07T04:30:00Z';
let keyCounter = 0;
const freshKey = () => `key-${(keyCounter += 1)}-${Date.now()}`;

const body = (w: World, startsAt = T10, durationMinutes = 60) => ({
  drawerId: w.drawerId,
  itemModelId: w.modelId,
  startsAt,
  durationMinutes,
});
const book = (who: Session | undefined, w: World, startsAt = T10, minutes = 60, key = freshKey()) =>
  call(who, 'POST', '/v1/bookings', body(w, startsAt, minutes), { 'idempotency-key': key });

async function hold(who: Session, w: World, startsAt = T10, minutes = 60): Promise<Booking> {
  const res = await book(who, w, startsAt, minutes);
  expect(res.statusCode, res.body).toBe(201);
  return res.json<Booking>();
}
async function pay(who: Session, id: string): Promise<Booking> {
  const order = await call(who, 'POST', `/v1/bookings/${id}/payment`);
  expect(order.statusCode, order.body).toBe(200);
  const checkout = await call(who, 'POST', `/v1/bookings/${id}/payment/simulate`);
  expect(checkout.statusCode, checkout.body).toBe(200);
  const done = await call(
    who,
    'POST',
    `/v1/bookings/${id}/payment/confirm`,
    checkout.json<Checkout>() as never,
  );
  expect(done.statusCode, done.body).toBe(200);
  return done.json<Booking>();
}
async function confirmed(who: Session, w: World, startsAt = T10, minutes = 60): Promise<Booking> {
  return pay(who, (await hold(who, w, startsAt, minutes)).id);
}
const count = async (sql: string, args: unknown[] = []) =>
  Number((await database.pool.query(sql, args)).rows[0].n);
const rows = async (sql: string, args: unknown[] = []) =>
  (await database.pool.query(sql, args)).rows;
const auditActions = async (entityId: string) =>
  (await rows('SELECT action FROM audit_logs WHERE entity_id = $1', [entityId]))
    .map((r) => r.action as string)
    .sort();

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
describe('creating a hold', () => {
  it('B-1 needs a signed-in customer and a well-formed request', async () => {
    const w = await world();
    expect((await book(undefined, w)).statusCode).toBe(401);

    const noKey = await call(alice, 'POST', '/v1/bookings', body(w));
    expect(noKey.statusCode).toBe(422);
    expect(noKey.json<Problem>().errors?.[0]?.field).toBe('Idempotency-Key');
    for (const key of ['short', 'has spaces in it', `${'k'.repeat(129)}`]) {
      const res = await call(alice, 'POST', '/v1/bookings', body(w), { 'idempotency-key': key });
      expect(res.statusCode, key).toBe(422);
    }

    const bad: Array<Record<string, unknown>> = [
      { ...body(w), extra: 1 },
      { ...body(w), drawerId: 'nope' },
      { ...body(w), itemModelId: 5 },
      { ...body(w), startsAt: '2030-01-07T04:30:00' }, // no UTC offset
      { ...body(w), startsAt: 'tomorrow' },
      { ...body(w), durationMinutes: '60' },
      { ...body(w), durationMinutes: 60.5 },
      { ...body(w), durationMinutes: 0 },
      { drawerId: w.drawerId },
    ];
    for (const payload of bad) {
      const res = await call(alice, 'POST', '/v1/bookings', payload, {
        'idempotency-key': freshKey(),
      });
      expect(res.statusCode, JSON.stringify(payload)).toBe(422);
      expect(res.json<Problem>().code).toBe('VALIDATION_FAILED');
    }
    expect(
      await count('SELECT count(*) AS n FROM bookings WHERE user_id = $1', [alice.user.id]),
    ).toBe(0);
  });

  it('B-2 holds the slot: price, deposit, expiry, the buffered occupancy, history and outbox are all written', async () => {
    const w = await world({ buffer: 15, deposit: 20000 });
    const res = await book(alice, w);
    expect(res.statusCode).toBe(201);
    const b = res.json<Booking>();
    expect(b).toMatchObject({
      status: 'held',
      startsAt: '2030-01-07T04:30:00.000Z',
      endsAt: '2030-01-07T05:30:00.000Z',
      durationMinutes: 60,
      pricePaise: 9800,
      depositPaise: 20000,
      totalPaise: 29800,
      cancellable: true,
      payment: null,
      refund: null,
    });
    expect(b.holdExpiresAt).toBe('2030-01-07T03:10:00.000Z'); // now + 10 minutes
    expect(b.assetCode).toMatch(/^M3-/);
    expect(b.drawer.timezone).toBe('Asia/Kolkata');

    const occ = await rows(
      `SELECT lower(during) AS from, upper(during) AS to, kind, released_at FROM asset_occupancies WHERE booking_id = $1`,
      [b.id],
    );
    expect(occ).toHaveLength(1);
    expect(occ[0].kind).toBe('booking');
    expect(occ[0].released_at).toBeNull();
    expect(new Date(occ[0].from).toISOString()).toBe('2030-01-07T04:30:00.000Z');
    expect(new Date(occ[0].to).toISOString()).toBe('2030-01-07T05:45:00.000Z'); // end + 15 min buffer

    expect(
      await rows(
        'SELECT from_status, to_status, actor_user_id FROM booking_events WHERE booking_id = $1',
        [b.id],
      ),
    ).toEqual([{ from_status: null, to_status: 'held', actor_user_id: alice.user.id }]);
    expect(
      await count(
        `SELECT count(*) AS n FROM outbox_events WHERE type = 'booking.held' AND payload->>'bookingId' = $1`,
        [b.id],
      ),
    ).toBe(1);
  });

  it('B-3 every business rule is enforced with its own code, and a refused request stores nothing', async () => {
    const w = await world();
    const cases: Array<[string, string, number, string, number]> = [
      // [label, startsAt, minutes, code, status]
      ['not a multiple of the slot', T10, 45, 'DURATION_INVALID', 422],
      ['shorter than the minimum', T10, 15, 'DURATION_INVALID', 422],
      ['longer than the maximum', T10, 270, 'DURATION_INVALID', 422],
      ['too soon (10 minutes ahead)', '2030-01-07T03:10:00Z', 60, 'LEAD_TIME_VIOLATION', 422],
      ['in the past', '2030-01-07T02:00:00Z', 60, 'LEAD_TIME_VIOLATION', 422],
      ['more than 90 days ahead', '2030-04-08T04:30:00Z', 60, 'LEAD_TIME_VIOLATION', 422],
      ['before opening (07:00 IST next day)', '2030-01-08T01:30:00Z', 60, 'DRAWER_CLOSED', 422],
      ['running past closing (21:30 IST + 60)', '2030-01-07T16:00:00Z', 60, 'DRAWER_CLOSED', 422],
      ['not on a whole minute', '2030-01-07T04:30:30Z', 60, 'VALIDATION_FAILED', 422],
    ];
    for (const [label, startsAt, minutes, code, status] of cases) {
      const res = await book(alice, w, startsAt, minutes);
      expect(res.statusCode, label).toBe(status);
      expect(res.json<Problem>().code, label).toBe(code);
    }
    expect(
      await count('SELECT count(*) AS n FROM bookings WHERE drawer_id = $1', [w.drawerId]),
    ).toBe(0);
    expect(
      await count('SELECT count(*) AS n FROM asset_occupancies WHERE asset_id = $1', [
        w.assetIds[0],
      ]),
    ).toBe(0);
  });

  it('B-4 closed drawers, closures and unknown things', async () => {
    const w = await world();
    // a closure 14:00–15:00 IST on that Monday
    await database.pool.query(
      `INSERT INTO drawer_closures (drawer_id, during) VALUES ($1, tstzrange('2030-01-07T08:30:00Z','2030-01-07T09:30:00Z','[)'))`,
      [w.drawerId],
    );
    expect((await book(alice, w, '2030-01-07T08:00:00Z', 60)).json<Problem>().code).toBe(
      'DRAWER_CLOSED',
    );
    expect((await book(alice, w, '2030-01-07T09:30:00Z', 60)).statusCode).toBe(201); // starts when the closure ends

    const closed = await world({ drawer: { status: 'temporarily_closed' } });
    expect((await book(alice, closed)).json<Problem>().code).toBe('DRAWER_CLOSED');

    const gone = await world({ drawer: { status: 'inactive' } });
    const other = await world();
    const inactiveModel = await world();
    await database.pool.query(`UPDATE item_models SET status = 'inactive' WHERE id = $1`, [
      inactiveModel.modelId,
    ]);
    const unknown = '00000000-0000-4000-8000-000000000000';
    const notFound: Array<[string, World | Record<string, unknown>]> = [
      ['inactive drawer', gone],
      ['inactive model', inactiveModel],
      [
        'model not offered at this drawer',
        { drawerId: w.drawerId, modelId: other.modelId, assetIds: [] },
      ],
      ['unknown drawer', { ...w, drawerId: unknown }],
      ['unknown model', { ...w, modelId: unknown }],
    ];
    for (const [label, target] of notFound) {
      const res = await book(alice, target as World, '2030-01-07T11:00:00Z');
      expect(res.statusCode, label).toBe(404);
      expect(res.json<Problem>().code, label).toBe('NOT_FOUND');
    }
  });

  it('B-5 one unit can be held by one customer only; the buffer after a rental blocks too; back-to-back after the buffer is fine', async () => {
    const w = await world({ buffer: 15 });
    await hold(alice, w); // 10:00–11:00 IST, occupancy until 11:15
    const clash = await book(bob, w);
    expect(clash.statusCode).toBe(409);
    expect(clash.json<Problem>().code).toBe('BOOKING_SLOT_TAKEN');
    expect((await book(bob, w, '2030-01-07T04:00:00Z', 60)).statusCode).toBe(409); // overlaps the start
    expect((await book(bob, w, '2030-01-07T05:30:00Z', 30)).statusCode).toBe(409); // inside the cleaning buffer
    expect((await book(bob, w, '2030-01-07T05:44:00Z', 30)).statusCode).toBe(409); // one minute inside
    expect((await book(bob, w, '2030-01-07T05:45:00Z', 30)).statusCode).toBe(201); // first free minute
    // and the stretch before: a rental plus its own buffer must end before the first one starts
    expect((await book(carol, w, '2030-01-07T04:00:00Z', 30)).statusCode).toBe(409); // 04:00–04:30 + 15 min buffer runs into 04:30
    expect((await book(carol, w, '2030-01-07T03:30:00Z', 30)).statusCode).toBe(201); // 03:30–04:00 + 15 min = 04:15, clear
  });

  it('B-6 with several units a second customer simply gets another unit', async () => {
    const w = await world({ assets: 2 });
    const first = await hold(alice, w);
    const second = await hold(bob, w);
    expect(second.assetCode).not.toBe(first.assetCode);
    expect((await book(carol, w)).json<Problem>().code).toBe('BOOKING_SLOT_TAKEN');
  });

  it('B-7 units in maintenance, retired units and admin blocks are never given out', async () => {
    const w = await world({ assets: 3 });
    await database.pool.query(`UPDATE assets SET status = 'maintenance' WHERE id = $1`, [
      w.assetIds[0],
    ]);
    await database.pool.query(`UPDATE assets SET status = 'retired' WHERE id = $1`, [
      w.assetIds[1],
    ]);
    const only = await hold(alice, w);
    expect(only.assetCode).toMatch(/-3$/);
    expect((await book(bob, w)).json<Problem>().code).toBe('BOOKING_SLOT_TAKEN');

    const blocked = await world();
    await database.pool.query(
      `INSERT INTO asset_occupancies (asset_id, kind, during) VALUES ($1, 'maintenance', tstzrange($2::timestamptz, $3::timestamptz, '[)'))`,
      [blocked.assetIds[0], '2030-01-07T04:00:00Z', '2030-01-07T05:00:00Z'],
    );
    expect((await book(alice, blocked)).json<Problem>().code).toBe('BOOKING_SLOT_TAKEN');
    expect((await book(alice, blocked, '2030-01-07T05:00:00Z', 60)).statusCode).toBe(201);
  });

  it('B-8 a hold that ran out does not block the slot: the next customer gets it and the old hold is expired', async () => {
    const w = await world();
    const first = await hold(alice, w);
    expect((await book(bob, w)).statusCode).toBe(409);

    clock.advance(11 * MIN); // past the 10-minute hold, the sweep has not run
    const second = await book(bob, w);
    expect(second.statusCode, second.body).toBe(201);

    const old = await call(alice, 'GET', `/v1/bookings/${first.id}`);
    expect(old.json<Booking>().status).toBe('expired');
    expect(
      await count(
        `SELECT count(*) AS n FROM outbox_events WHERE type = 'booking.expired' AND payload->>'bookingId' = $1`,
        [first.id],
      ),
    ).toBe(1);
    expect(
      (
        await rows(
          'SELECT to_status FROM booking_events WHERE booking_id = $1 ORDER BY at, to_status',
          [first.id],
        )
      ).map((r) => r.to_status),
    ).toEqual(expect.arrayContaining(['held', 'expired']));
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
describe('reading your bookings', () => {
  it('R-1 a customer sees only their own bookings; someone else’s is 404, exactly like a missing one', async () => {
    const w = await world({ assets: 2 });
    const a = await hold(alice, w);
    const b = await hold(bob, w);

    const mine = (await call(alice, 'GET', '/v1/bookings')).json<Booking[]>();
    expect(mine.map((x) => x.id)).toContain(a.id);
    expect(mine.map((x) => x.id)).not.toContain(b.id);
    expect((await call(alice, 'GET', `/v1/bookings/${a.id}`)).statusCode).toBe(200);
    for (const id of [b.id, '00000000-0000-4000-8000-000000000000', 'not-a-uuid']) {
      const res = await call(alice, 'GET', `/v1/bookings/${id}`);
      expect(res.statusCode, id).toBe(404);
      expect(res.json<Problem>().code).toBe('NOT_FOUND');
    }
    expect((await call(undefined, 'GET', '/v1/bookings')).statusCode).toBe(401);
    expect((await call(undefined, 'GET', `/v1/bookings/${a.id}`)).statusCode).toBe(401);
  });

  it('R-2 the list can be filtered by status; an unknown status is refused', async () => {
    const w = await world({ assets: 2 });
    const kept = await hold(carol, w);
    const gone = await hold(carol, w, '2030-01-07T08:00:00Z', 30);
    await call(carol, 'POST', `/v1/bookings/${gone.id}/cancel`);
    const held = (await call(carol, 'GET', '/v1/bookings?status=held')).json<Booking[]>();
    expect(held.map((x) => x.id)).toContain(kept.id);
    expect(held.map((x) => x.id)).not.toContain(gone.id);
    const cancelled = (await call(carol, 'GET', '/v1/bookings?status=cancelled')).json<Booking[]>();
    expect(cancelled.map((x) => x.id)).toContain(gone.id);
    expect((await call(carol, 'GET', '/v1/bookings?status=maybe')).statusCode).toBe(422);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
describe('idempotency', () => {
  it('I-1 retrying with the same key and body returns the original booking (200) and creates nothing new', async () => {
    const w = await world();
    const key = freshKey();
    const first = await book(alice, w, T10, 60, key);
    expect(first.statusCode).toBe(201);
    const again = await book(alice, w, T10, 60, key);
    expect(again.statusCode).toBe(200);
    expect(again.headers['idempotency-replayed']).toBe('true');
    expect(again.json<Booking>()).toEqual(first.json<Booking>());
    expect(
      await count('SELECT count(*) AS n FROM bookings WHERE drawer_id = $1', [w.drawerId]),
    ).toBe(1);
    expect(
      await count('SELECT count(*) AS n FROM asset_occupancies WHERE asset_id = $1', [
        w.assetIds[0],
      ]),
    ).toBe(1);
  });

  it('I-2 the same key with a different request is refused; the order of the JSON fields does not matter', async () => {
    const w = await world();
    const key = freshKey();
    expect((await book(alice, w, T10, 60, key)).statusCode).toBe(201);
    const other = await book(alice, w, T10, 90, key);
    expect(other.statusCode).toBe(422);
    expect(other.json<Problem>().code).toBe('IDEMPOTENCY_KEY_REUSED');

    const reordered = await call(
      alice,
      'POST',
      '/v1/bookings',
      { durationMinutes: 60, startsAt: T10, itemModelId: w.modelId, drawerId: w.drawerId },
      { 'idempotency-key': key },
    );
    expect(reordered.statusCode).toBe(200);
    expect(
      await count('SELECT count(*) AS n FROM bookings WHERE drawer_id = $1', [w.drawerId]),
    ).toBe(1);
  });

  it('I-3 keys are per customer: another customer may use the same key', async () => {
    const w = await world({ assets: 2 });
    const key = freshKey();
    const a = await book(alice, w, T10, 60, key);
    const b = await book(bob, w, T10, 60, key);
    expect(a.statusCode).toBe(201);
    expect(b.statusCode).toBe(201);
    expect(a.json<Booking>().id).not.toBe(b.json<Booking>().id);
  });

  it('I-4 a failed attempt does not burn the key: after the slot is free, the same key works', async () => {
    const w = await world();
    const first = await hold(alice, w);
    const key = freshKey();
    const refused = await book(bob, w, T10, 60, key);
    expect(refused.statusCode).toBe(409);
    await call(alice, 'POST', `/v1/bookings/${first.id}/cancel`);
    const retry = await book(bob, w, T10, 60, key);
    expect(retry.statusCode, retry.body).toBe(201);
  });

  it('I-5 five identical requests at once create exactly one booking', async () => {
    const w = await world({ assets: 3 });
    const key = freshKey();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => book(alice, w, T10, 60, key)),
    );
    const codes = results.map((r) => r.statusCode).sort();
    expect(codes.filter((c) => c === 201)).toHaveLength(1);
    for (const r of results.filter((x) => x.statusCode !== 201)) {
      if (r.statusCode === 409) expect(r.json<Problem>().code).toBe('REQUEST_IN_PROGRESS');
      else expect(r.statusCode).toBe(200);
    }
    expect(
      await count('SELECT count(*) AS n FROM bookings WHERE drawer_id = $1', [w.drawerId]),
    ).toBe(1);
  });

  it('I-6 a request that is still running answers 409 REQUEST_IN_PROGRESS; a claim abandoned for 2+ minutes is taken over', async () => {
    const w = await world();
    const key = freshKey();
    const hash = requestHash('POST', '/v1/bookings', body(w));
    await database.pool.query(
      `INSERT INTO idempotency_keys (user_id, key, request_hash, created_at) VALUES ($1, $2, $3, $4)`,
      [alice.user.id, key, hash, clock.now()],
    );
    const busy = await book(alice, w, T10, 60, key);
    expect(busy.statusCode).toBe(409);
    expect(busy.json<Problem>().code).toBe('REQUEST_IN_PROGRESS');
    expect(
      await count('SELECT count(*) AS n FROM bookings WHERE drawer_id = $1', [w.drawerId]),
    ).toBe(0);

    clock.advance(3 * MIN);
    const taken = await book(alice, w, T10, 60, key);
    expect(taken.statusCode, taken.body).toBe(201);
  });

  it('I-7 stored keys are removed after 24 hours by the background sweep, and not before', async () => {
    const w = await world();
    const key = freshKey();
    await book(alice, w, T10, 60, key);
    const has = () => count('SELECT count(*) AS n FROM idempotency_keys WHERE key = $1', [key]);
    clock.advance(23 * 60 * MIN);
    await jobs.runOnce();
    expect(await has()).toBe(1);
    clock.advance(2 * 60 * MIN);
    const report = await jobs.runOnce();
    expect(report.idempotencyPurged).toBeGreaterThanOrEqual(1);
    expect(await has()).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
describe('paying', () => {
  it('P-1 the order is for rental + deposit, and asking again returns the same order', async () => {
    const w = await world({ deposit: 20000 });
    const b = await hold(alice, w);
    const one = await call(alice, 'POST', `/v1/bookings/${b.id}/payment`);
    const two = await call(alice, 'POST', `/v1/bookings/${b.id}/payment`);
    expect(one.statusCode).toBe(200);
    expect(one.json<Order>()).toMatchObject({
      provider: 'fake',
      amountPaise: 29800,
      currency: 'INR',
    });
    expect(two.json<Order>().orderId).toBe(one.json<Order>().orderId);
    expect(await count('SELECT count(*) AS n FROM payments WHERE booking_id = $1', [b.id])).toBe(1);
    expect(
      (await call(alice, 'GET', `/v1/bookings/${b.id}`)).json<Booking>().payment,
    ).toMatchObject({ status: 'created', amountPaise: 29800 });
  });

  it('P-2 paying confirms the booking: held → confirmed, payment captured, history and outbox written', async () => {
    const w = await world();
    const held = await hold(alice, w);
    const done = await pay(alice, held.id);
    expect(done).toMatchObject({ status: 'confirmed', holdExpiresAt: null, cancellable: true });
    expect(done.payment).toMatchObject({ status: 'captured', amountPaise: 29800 });
    expect(
      (
        await rows(
          'SELECT from_status, to_status FROM booking_events WHERE booking_id = $1 ORDER BY at, to_status',
          [held.id],
        )
      )
        .map((r) => r.to_status)
        .sort(),
    ).toEqual(['confirmed', 'held']);
    expect(
      await count(
        `SELECT count(*) AS n FROM outbox_events WHERE type = 'booking.confirmed' AND payload->>'bookingId' = $1`,
        [held.id],
      ),
    ).toBe(1);

    // there is nothing left to pay: no second checkout for a confirmed booking
    const second = await call(alice, 'POST', `/v1/bookings/${held.id}/payment/simulate`);
    expect(second.statusCode).toBe(409);
    expect(second.json<Problem>().code).toBe('INVALID_STATE');
    expect(
      await count('SELECT count(*) AS n FROM booking_events WHERE booking_id = $1', [held.id]),
    ).toBe(2);
  });

  it('P-3 repeating the very same confirmation changes nothing', async () => {
    const w = await world();
    const b = await hold(alice, w);
    await call(alice, 'POST', `/v1/bookings/${b.id}/payment`);
    const checkout = (
      await call(alice, 'POST', `/v1/bookings/${b.id}/payment/simulate`)
    ).json<Checkout>();
    const confirm = () =>
      call(alice, 'POST', `/v1/bookings/${b.id}/payment/confirm`, checkout as never);
    expect((await confirm()).statusCode).toBe(200);
    const events = await count('SELECT count(*) AS n FROM booking_events WHERE booking_id = $1', [
      b.id,
    ]);
    const again = await confirm();
    expect(again.statusCode).toBe(200);
    expect(again.json<Booking>().status).toBe('confirmed');
    expect(
      await count('SELECT count(*) AS n FROM booking_events WHERE booking_id = $1', [b.id]),
    ).toBe(events);
    expect(await count('SELECT count(*) AS n FROM payments WHERE booking_id = $1', [b.id])).toBe(1);
  });

  it('P-4 a confirmation that does not verify is refused and the booking stays held', async () => {
    const w = await world({ assets: 2 });
    const b = await hold(alice, w);
    await call(alice, 'POST', `/v1/bookings/${b.id}/payment`);
    const real = (
      await call(alice, 'POST', `/v1/bookings/${b.id}/payment/simulate`)
    ).json<Checkout>();
    const tampered: Array<Record<string, unknown>> = [
      { ...real, signature: 'deadbeef' },
      { ...real, signature: '' },
      { ...real, paymentId: 'fake_pay_somebody_else' },
      { ...real, orderId: 'fake_order_other' },
      { orderId: real.orderId, paymentId: real.paymentId },
    ];
    for (const payload of tampered) {
      const res = await call(alice, 'POST', `/v1/bookings/${b.id}/payment/confirm`, payload);
      expect(res.statusCode, JSON.stringify(payload)).toBe(422);
      expect(['PAYMENT_INVALID', 'VALIDATION_FAILED']).toContain(res.json<Problem>().code);
    }
    expect((await call(alice, 'GET', `/v1/bookings/${b.id}`)).json<Booking>().status).toBe('held');
    // a signature that is valid for ANOTHER booking's order does not confirm this one
    const other = await hold(bob, w, '2030-01-07T08:00:00Z', 30);
    await call(bob, 'POST', `/v1/bookings/${other.id}/payment`);
    const theirs = (
      await call(bob, 'POST', `/v1/bookings/${other.id}/payment/simulate`)
    ).json<Checkout>();
    const cross = await call(
      alice,
      'POST',
      `/v1/bookings/${b.id}/payment/confirm`,
      theirs as never,
    );
    expect(cross.json<Problem>().code).toBe('PAYMENT_INVALID');
    // and nobody can confirm or pay for somebody else’s booking at all
    expect(
      (await call(bob, 'POST', `/v1/bookings/${b.id}/payment/confirm`, real as never)).statusCode,
    ).toBe(404);
    expect((await call(bob, 'POST', `/v1/bookings/${b.id}/payment`)).statusCode).toBe(404);
    expect((await call(bob, 'POST', `/v1/bookings/${b.id}/payment/simulate`)).statusCode).toBe(404);
    expect(
      await count(
        `SELECT count(*) AS n FROM payments WHERE booking_id = $1 AND status = 'captured'`,
        [b.id],
      ),
    ).toBe(0);
  });

  it('P-5 no order means nothing to simulate or confirm', async () => {
    const w = await world();
    const b = await hold(alice, w);
    const sim = await call(alice, 'POST', `/v1/bookings/${b.id}/payment/simulate`);
    expect(sim.statusCode).toBe(409);
    expect(sim.json<Problem>().code).toBe('INVALID_STATE');
    const conf = await call(alice, 'POST', `/v1/bookings/${b.id}/payment/confirm`, {
      orderId: 'x',
      paymentId: 'y',
      signature: 'z',
    });
    expect(conf.json<Problem>().code).toBe('PAYMENT_INVALID');
  });

  it('P-6 a hold that has run out cannot start a new payment; a cancelled or finished booking cannot be paid', async () => {
    const w = await world({ assets: 3 });
    const late = await hold(alice, w);
    clock.advance(11 * MIN);
    const res = await call(alice, 'POST', `/v1/bookings/${late.id}/payment`);
    expect(res.statusCode).toBe(410);
    expect(res.json<Problem>().code).toBe('HOLD_EXPIRED');

    clock.set(START);
    const gone = await hold(alice, w, '2030-01-07T08:00:00Z', 30);
    await call(alice, 'POST', `/v1/bookings/${gone.id}/cancel`);
    const cancelled = await call(alice, 'POST', `/v1/bookings/${gone.id}/payment`);
    expect(cancelled.statusCode).toBe(409);
    expect(cancelled.json<Problem>().code).toBe('INVALID_STATE');

    const done = await confirmed(alice, w, '2030-01-07T10:00:00Z', 30);
    expect(
      (await call(alice, 'POST', `/v1/bookings/${done.id}/payment`)).json<Problem>().code,
    ).toBe('INVALID_STATE');
  });

  it('P-7 late payment: the order was created, the hold expired and was swept, the slot is still free ⇒ the payment is honoured', async () => {
    const w = await world();
    const b = await hold(alice, w);
    await call(alice, 'POST', `/v1/bookings/${b.id}/payment`);
    const checkout = (
      await call(alice, 'POST', `/v1/bookings/${b.id}/payment/simulate`)
    ).json<Checkout>();

    clock.advance(11 * MIN);
    expect((await jobs.runOnce()).expiredHolds).toBeGreaterThanOrEqual(1);
    expect((await call(alice, 'GET', `/v1/bookings/${b.id}`)).json<Booking>().status).toBe(
      'expired',
    );

    const res = await call(
      alice,
      'POST',
      `/v1/bookings/${b.id}/payment/confirm`,
      checkout as never,
    );
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json<Booking>()).toMatchObject({ status: 'confirmed', holdExpiresAt: null });
    // the slot is blocked again — nobody else can take it
    expect((await book(bob, w)).json<Problem>().code).toBe('BOOKING_SLOT_TAKEN');
  });

  it('P-8 late payment but the slot was taken meanwhile ⇒ 410 HOLD_EXPIRED, nothing captured, the new owner is untouched', async () => {
    const w = await world();
    const b = await hold(alice, w);
    await call(alice, 'POST', `/v1/bookings/${b.id}/payment`);
    const checkout = (
      await call(alice, 'POST', `/v1/bookings/${b.id}/payment/simulate`)
    ).json<Checkout>();

    clock.advance(11 * MIN);
    await jobs.runOnce();
    const taker = await hold(bob, w);

    const res = await call(
      alice,
      'POST',
      `/v1/bookings/${b.id}/payment/confirm`,
      checkout as never,
    );
    expect(res.statusCode).toBe(410);
    expect(res.json<Problem>().code).toBe('HOLD_EXPIRED');
    expect((await call(alice, 'GET', `/v1/bookings/${b.id}`)).json<Booking>().status).toBe(
      'expired',
    );
    expect((await call(bob, 'GET', `/v1/bookings/${taker.id}`)).json<Booking>().status).toBe(
      'held',
    );
    expect(
      await count(
        `SELECT count(*) AS n FROM payments WHERE booking_id = $1 AND status = 'captured'`,
        [b.id],
      ),
    ).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
describe('cancelling and refunds', () => {
  const FAR = '2030-01-09T04:30:00Z'; // two days ahead of START
  const farStart = new Date(FAR).getTime();

  it('C-1 cancelling a hold frees the slot at once and refunds nothing (nothing was paid)', async () => {
    const w = await world();
    const b = await hold(alice, w);
    await call(alice, 'POST', `/v1/bookings/${b.id}/payment`);
    const res = await call(alice, 'POST', `/v1/bookings/${b.id}/cancel`);
    expect(res.statusCode).toBe(200);
    expect(res.json<Booking>()).toMatchObject({
      status: 'cancelled',
      cancellable: false,
      refund: null,
    });
    expect(await count('SELECT count(*) AS n FROM refunds WHERE booking_id = $1', [b.id])).toBe(0);
    expect(
      await count(
        'SELECT count(*) AS n FROM asset_occupancies WHERE booking_id = $1 AND released_at IS NULL',
        [b.id],
      ),
    ).toBe(0);
    expect(
      await count(
        `SELECT count(*) AS n FROM payments WHERE booking_id = $1 AND status = 'failed'`,
        [b.id],
      ),
    ).toBe(1);
    expect((await book(bob, w)).statusCode).toBe(201); // cancel, then rebook the same slot
  });

  it.each([
    ['more than 24 hours before the start', () => START, 29800],
    [
      'exactly 24 hours before the start',
      () => new Date(farStart - 24 * 60 * MIN).toISOString(),
      29800,
    ],
    [
      '23 h 59 min before the start',
      () => new Date(farStart - (24 * 60 - 1) * MIN).toISOString(),
      4900 + 20000,
    ],
    [
      'exactly 2 hours before the start',
      () => new Date(farStart - 120 * MIN).toISOString(),
      4900 + 20000,
    ],
    ['1 h 59 min before the start', () => new Date(farStart - 119 * MIN).toISOString(), 20000],
    ['after the start, nobody came', () => new Date(farStart + 5 * MIN).toISOString(), 20000],
  ])('C-2 refund %s', async (_label, when, expected) => {
    const w = await world();
    const b = await confirmed(alice, w, FAR, 60);
    clock.set(when());
    const res = await call(alice, 'POST', `/v1/bookings/${b.id}/cancel`);
    expect(res.statusCode, res.body).toBe(200);
    const cancelled = res.json<Booking>();
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.refund).toEqual({ amountPaise: expected, status: 'processed' });
    expect(cancelled.payment?.status).toBe('refunded');
    const refund = await rows(
      'SELECT amount_paise, status, provider_refund_id FROM refunds WHERE booking_id = $1',
      [b.id],
    );
    expect(refund).toHaveLength(1);
    expect(refund[0].provider_refund_id).toMatch(/^fake_refund_/);
  });

  it('C-3 cancelling twice is harmless: same answer, one refund, one history entry', async () => {
    const w = await world();
    const b = await confirmed(alice, w, FAR, 60);
    const first = await call(alice, 'POST', `/v1/bookings/${b.id}/cancel`);
    const second = await call(alice, 'POST', `/v1/bookings/${b.id}/cancel`);
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json<Booking>()).toEqual(first.json<Booking>());
    expect(await count('SELECT count(*) AS n FROM refunds WHERE booking_id = $1', [b.id])).toBe(1);
    expect(
      await count(
        `SELECT count(*) AS n FROM booking_events WHERE booking_id = $1 AND to_status = 'cancelled'`,
        [b.id],
      ),
    ).toBe(1);
  });

  it('C-4 five cancellations at once still refund exactly once', async () => {
    const w = await world();
    const b = await confirmed(alice, w, FAR, 60);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => call(alice, 'POST', `/v1/bookings/${b.id}/cancel`)),
    );
    for (const r of results) expect(r.statusCode, r.body).toBe(200);
    expect(await count('SELECT count(*) AS n FROM refunds WHERE booking_id = $1', [b.id])).toBe(1);
  });

  it('C-5 only the owner can cancel; others get 404 and nothing changes', async () => {
    const w = await world();
    const b = await confirmed(alice, w, FAR, 60);
    expect((await call(bob, 'POST', `/v1/bookings/${b.id}/cancel`)).statusCode).toBe(404);
    expect((await call(undefined, 'POST', `/v1/bookings/${b.id}/cancel`)).statusCode).toBe(401);
    expect((await call(alice, 'GET', `/v1/bookings/${b.id}`)).json<Booking>().status).toBe(
      'confirmed',
    );
  });

  it('C-6 a rental that has started, or a booking that is over, cannot be cancelled', async () => {
    const w = await world({ assets: 3 });
    const active = await confirmed(alice, w, T10, 60);
    clock.set(T10);
    expect((await call(boss, 'POST', `/v1/admin/bookings/${active.id}/pickup`)).statusCode).toBe(
      200,
    );
    const res = await call(alice, 'POST', `/v1/bookings/${active.id}/cancel`);
    expect(res.statusCode).toBe(409);
    expect(res.json<Problem>().code).toBe('INVALID_STATE');

    clock.set(START);
    const expired = await hold(bob, w, '2030-01-07T08:00:00Z', 30);
    clock.advance(11 * MIN);
    await jobs.runOnce();
    expect(
      (await call(bob, 'POST', `/v1/bookings/${expired.id}/cancel`)).json<Problem>().code,
    ).toBe('INVALID_STATE');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
describe('staff', () => {
  it('S-1 permissions: no token 401, customers 403, read-only staff cannot change anything', async () => {
    const w = await world();
    const b = await confirmed(alice, w, '2030-01-09T04:30:00Z', 60);
    const reader = await register();
    await grantPermissions(database.pool, reader.user.id, ['bookings:read']);

    for (const [method, url] of [
      ['GET', '/v1/admin/bookings'],
      ['GET', `/v1/admin/bookings/${b.id}`],
      ['POST', `/v1/admin/bookings/${b.id}/cancel`],
      ['POST', `/v1/admin/bookings/${b.id}/pickup`],
      ['POST', `/v1/admin/bookings/${b.id}/return`],
    ] as const) {
      expect(
        (await call(undefined, method, url, method === 'POST' ? { reason: 'test run' } : undefined))
          .statusCode,
        `${method} ${url}`,
      ).toBe(401);
      expect(
        (await call(alice, method, url, method === 'POST' ? { reason: 'test run' } : undefined))
          .statusCode,
        `${method} ${url}`,
      ).toBe(403);
    }
    expect((await call(reader, 'GET', `/v1/admin/bookings/${b.id}`)).statusCode).toBe(200);
    for (const action of ['cancel', 'pickup', 'return']) {
      const res = await call(reader, 'POST', `/v1/admin/bookings/${b.id}/${action}`, {
        reason: 'because',
      });
      expect(res.statusCode, action).toBe(403);
    }
    expect((await call(alice, 'GET', `/v1/bookings/${b.id}`)).json<Booking>().status).toBe(
      'confirmed',
    );
  });

  it('S-2 staff cancel needs a reason, is audited, and refunds by the same policy', async () => {
    const w = await world();
    const b = await confirmed(alice, w, '2030-01-09T04:30:00Z', 60);
    const canceller = await register();
    await grantPermissions(database.pool, canceller.user.id, ['bookings:read', 'bookings:cancel']);

    expect(
      (await call(canceller, 'POST', `/v1/admin/bookings/${b.id}/cancel`, {})).statusCode,
    ).toBe(422);
    expect(
      (await call(canceller, 'POST', `/v1/admin/bookings/${b.id}/cancel`, { reason: 'x' }))
        .statusCode,
    ).toBe(422);
    const res = await call(canceller, 'POST', `/v1/admin/bookings/${b.id}/cancel`, {
      reason: 'Unit damaged',
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json<Booking>()).toMatchObject({
      status: 'cancelled',
      cancelReason: 'Unit damaged',
      refund: { amountPaise: 29800, status: 'processed' },
    });
    expect(await auditActions(b.id)).toEqual(['booking.cancelled']);
    const audit = await rows(`SELECT actor_id, reason FROM audit_logs WHERE entity_id = $1`, [
      b.id,
    ]);
    expect(audit[0]).toEqual({ actor_id: canceller.user.id, reason: 'Unit damaged' });
  });

  it('S-3 overriding the refund percentage needs bookings:refund — without it nothing happens', async () => {
    const w = await world({ assets: 2 });
    const soon = '2030-01-07T04:30:00Z'; // 90 minutes after START ⇒ the policy would refund 0 % of the rental
    const b = await confirmed(alice, w, soon, 60);
    const canceller = await register();
    await grantPermissions(database.pool, canceller.user.id, ['bookings:read', 'bookings:cancel']);
    const denied = await call(canceller, 'POST', `/v1/admin/bookings/${b.id}/cancel`, {
      reason: 'goodwill',
      refundPercent: 100,
    });
    expect(denied.statusCode).toBe(403);
    expect((await call(alice, 'GET', `/v1/bookings/${b.id}`)).json<Booking>().status).toBe(
      'confirmed',
    );

    const finance = await register();
    await grantPermissions(database.pool, finance.user.id, [
      'bookings:read',
      'bookings:cancel',
      'bookings:refund',
    ]);
    const ok = await call(finance, 'POST', `/v1/admin/bookings/${b.id}/cancel`, {
      reason: 'goodwill',
      refundPercent: 100,
    });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json<Booking>().refund).toEqual({ amountPaise: 29800, status: 'processed' });
    const bad = await call(finance, 'POST', `/v1/admin/bookings/${b.id}/cancel`, {
      reason: 'again',
      refundPercent: 101,
    });
    expect(bad.statusCode).toBe(422);
  });

  it('S-4 an administrator limited to one drawer sees and changes only that drawer’s bookings', async () => {
    const mine = await world();
    const theirs = await world();
    const a = await confirmed(alice, mine, '2030-01-09T04:30:00Z', 60);
    const b = await confirmed(bob, theirs, '2030-01-09T04:30:00Z', 60);
    const scoped = await register();
    await grantPermissions(
      database.pool,
      scoped.user.id,
      ['bookings:read', 'bookings:cancel', 'bookings:write'],
      mine.drawerId,
    );

    const list = (await call(scoped, 'GET', '/v1/admin/bookings')).json<Page>();
    expect(list.items.map((x) => x.id)).toContain(a.id);
    expect(list.items.map((x) => x.id)).not.toContain(b.id);
    expect((await call(scoped, 'GET', `/v1/admin/bookings/${b.id}`)).statusCode).toBe(404);
    expect(
      (await call(scoped, 'GET', `/v1/admin/bookings?drawerId=${theirs.drawerId}`)).json<Page>()
        .items,
    ).toEqual([]);
    for (const action of ['pickup', 'return']) {
      expect(
        (await call(scoped, 'POST', `/v1/admin/bookings/${b.id}/${action}`)).statusCode,
        action,
      ).toBe(404);
    }
    expect(
      (await call(scoped, 'POST', `/v1/admin/bookings/${b.id}/cancel`, { reason: 'not mine' }))
        .statusCode,
    ).toBe(404);
    expect((await call(bob, 'GET', `/v1/bookings/${b.id}`)).json<Booking>().status).toBe(
      'confirmed',
    );
    expect(
      (await call(scoped, 'POST', `/v1/admin/bookings/${a.id}/cancel`, { reason: 'mine' }))
        .statusCode,
    ).toBe(200);
  });

  it('S-5 listing: newest first, filters, search, and cursor paging without gaps or repeats', async () => {
    const w = await world({ assets: 7 });
    const ids: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      clock.advance(MIN);
      ids.unshift((await hold(i % 2 === 0 ? alice : bob, w, T10, 60)).id);
    }
    const all: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const url = `/v1/admin/bookings?drawerId=${w.drawerId}&limit=3${cursor ? `&cursor=${cursor}` : ''}`;
      const page: Page = (await call(boss, 'GET', url)).json<Page>();
      all.push(...page.items.map((x) => x.id));
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor && pages < 10);
    expect(pages).toBe(3);
    expect(all).toEqual(ids); // newest first, nothing missing, nothing twice

    const byUser = (
      await call(
        boss,
        'GET',
        `/v1/admin/bookings?drawerId=${w.drawerId}&limit=100&q=${encodeURIComponent((await rows('SELECT email FROM users WHERE id = $1', [bob.user.id]))[0].email)}`,
      )
    ).json<Page>();
    expect(byUser.items).toHaveLength(3);
    expect(byUser.items.every((x) => x.customer.id === bob.user.id)).toBe(true);
    expect(
      (
        await call(boss, 'GET', `/v1/admin/bookings?drawerId=${w.drawerId}&status=confirmed`)
      ).json<Page>().items,
    ).toEqual([]);
    expect((await call(boss, 'GET', '/v1/admin/bookings?status=maybe')).statusCode).toBe(422);
    expect((await call(boss, 'GET', '/v1/admin/bookings?cursor=garbage')).statusCode).toBe(422);
    expect((await call(boss, 'GET', '/v1/admin/bookings?limit=0')).statusCode).toBe(422);
    expect((await call(boss, 'GET', '/v1/admin/bookings?limit=101')).statusCode).toBe(422);
  });

  it('S-6 the detail shows the history, the payment and the refund', async () => {
    const w = await world();
    const b = await hold(alice, w, '2030-01-09T04:30:00Z', 60);
    clock.advance(1000); // history is ordered by time: keep the fake clock moving between steps
    await pay(alice, b.id);
    clock.advance(1000);
    await call(alice, 'POST', `/v1/bookings/${b.id}/cancel`);
    const detail = (await call(boss, 'GET', `/v1/admin/bookings/${b.id}`)).json<AdminDetail>();
    expect(detail.history.map((h) => [h.from, h.to])).toEqual([
      [null, 'held'],
      ['held', 'confirmed'],
      ['confirmed', 'cancelled'],
    ]);
    expect(detail.history[2]?.actorUserId).toBe(alice.user.id);
    expect(detail.payment?.status).toBe('refunded');
    expect(detail.refund?.amountPaise).toBe(29800);
    expect(detail.customer.id).toBe(alice.user.id);
    expect((await call(boss, 'GET', '/v1/admin/bookings/not-a-uuid')).statusCode).toBe(404);
  });

  it('S-7 hand-over and return: confirmed → active → completed, with the right windows and audit rows', async () => {
    const w = await world();
    const b = await confirmed(alice, w, T10, 60);

    // not before PICKUP_EARLY_MINUTES (15) ahead of the start
    clock.set(new Date(new Date(T10).getTime() - 16 * MIN));
    const early = await call(boss, 'POST', `/v1/admin/bookings/${b.id}/pickup`);
    expect(early.statusCode).toBe(409);
    expect(early.json<Problem>().code).toBe('INVALID_STATE');
    expect((await call(boss, 'POST', `/v1/admin/bookings/${b.id}/return`)).statusCode).toBe(409); // not handed over yet

    clock.set(new Date(new Date(T10).getTime() - 15 * MIN));
    const out = await call(boss, 'POST', `/v1/admin/bookings/${b.id}/pickup`);
    expect(out.statusCode, out.body).toBe(200);
    expect(out.json<Booking>()).toMatchObject({ status: 'active', cancellable: false });
    expect((await call(boss, 'POST', `/v1/admin/bookings/${b.id}/pickup`)).statusCode).toBe(409); // not twice

    clock.set(new Date(new Date(T10).getTime() + 30 * MIN)); // returned half way
    const back = await call(boss, 'POST', `/v1/admin/bookings/${b.id}/return`);
    expect(back.statusCode, back.body).toBe(200);
    expect(back.json<Booking>().status).toBe('completed');
    expect(await auditActions(b.id)).toEqual(['booking.picked_up', 'booking.returned']);
    expect((await call(boss, 'POST', `/v1/admin/bookings/${b.id}/return`)).statusCode).toBe(409);
    expect((await call(alice, 'POST', `/v1/bookings/${b.id}/cancel`)).statusCode).toBe(409);
  });

  it('S-8 an early return frees the unit right after the buffer: the freed time can be booked again', async () => {
    const w = await world({ buffer: 15 });
    const b = await confirmed(alice, w, T10, 120); // 10:00–12:00 IST, occupancy until 12:15
    clock.set(new Date(new Date(T10).getTime() + 5 * MIN));
    await call(boss, 'POST', `/v1/admin/bookings/${b.id}/pickup`);
    clock.set(new Date(new Date(T10).getTime() + 30 * MIN)); // back after 30 minutes (04:30Z + 30 = 05:00Z)
    expect((await call(boss, 'POST', `/v1/admin/bookings/${b.id}/return`)).statusCode).toBe(200);
    clock.set(START);
    // occupancy now ends at 05:15Z: 05:00Z–05:15Z is still the cleaning buffer…
    expect((await book(bob, w, '2030-01-07T05:00:00Z', 30)).statusCode).toBe(409);
    // …and from 05:15Z the unit is free again, long before the original 12:15
    expect((await book(bob, w, '2030-01-07T05:15:00Z', 60)).statusCode).toBe(201);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
describe('background sweeps', () => {
  /** Runs the sweep until the outbox has nothing left that is due (a sweep delivers at most 100 events). */
  const drain = async () => {
    for (let i = 0; i < 20; i += 1) if ((await jobs.runOnce()).outboxDelivered === 0) return;
  };

  it('J-1 expiring holds: once, idempotently, with history and outbox; the slot is bookable at once', async () => {
    const w = await world();
    const b = await hold(alice, w);
    expect((await jobs.runOnce()).expiredHolds).toBe(0); // still within the hold
    clock.advance(10 * MIN);
    const first = await jobs.runOnce();
    expect(first.expiredHolds).toBeGreaterThanOrEqual(1);
    expect((await jobs.runOnce()).expiredHolds).toBe(0);
    expect((await call(alice, 'GET', `/v1/bookings/${b.id}`)).json<Booking>().status).toBe(
      'expired',
    );
    expect(
      await count(
        `SELECT count(*) AS n FROM booking_events WHERE booking_id = $1 AND to_status = 'expired'`,
        [b.id],
      ),
    ).toBe(1);
    expect(
      await count(
        `SELECT count(*) AS n FROM outbox_events WHERE type = 'booking.expired' AND payload->>'bookingId' = $1`,
        [b.id],
      ),
    ).toBe(1);
    expect((await book(bob, w)).statusCode).toBe(201);
  });

  it('J-2 two sweeps at the same time never process a hold twice', async () => {
    const worlds = await Promise.all([world(), world(), world()]);
    for (const w of worlds) await hold(alice, w);
    clock.advance(11 * MIN);
    const reports = await Promise.all([jobs.runOnce(), jobs.runOnce(), jobs.runOnce()]);
    const total = reports.reduce((sum, r) => sum + r.expiredHolds, 0);
    expect(total).toBeGreaterThanOrEqual(3);
    const dupes = await rows(
      `SELECT booking_id FROM booking_events WHERE to_status = 'expired' GROUP BY booking_id HAVING count(*) > 1`,
    );
    expect(dupes).toEqual([]);
  });

  it('J-3 a rental not returned by its end becomes overdue and keeps the unit; the hand-back still completes it', async () => {
    const w = await world();
    const b = await confirmed(alice, w, T10, 60);
    clock.set(T10);
    await call(boss, 'POST', `/v1/admin/bookings/${b.id}/pickup`);
    clock.set(new Date(new Date(T10).getTime() + 61 * MIN));
    expect((await jobs.runOnce()).overdue).toBeGreaterThanOrEqual(1);
    expect((await call(alice, 'GET', `/v1/bookings/${b.id}`)).json<Booking>().status).toBe(
      'overdue',
    );
    expect(
      await count(
        'SELECT count(*) AS n FROM asset_occupancies WHERE booking_id = $1 AND released_at IS NULL',
        [b.id],
      ),
    ).toBe(1);
    expect(
      (await call(boss, 'POST', `/v1/admin/bookings/${b.id}/return`)).json<Booking>().status,
    ).toBe('completed');
  });

  it('J-4 a booking nobody collected becomes a no-show after the grace period and frees the unit (no refund)', async () => {
    const w = await world();
    const b = await confirmed(alice, w, T10, 60);
    clock.set(new Date(new Date(T10).getTime() + 29 * MIN));
    expect((await jobs.runOnce()).noShows).toBe(0);
    expect((await call(alice, 'GET', `/v1/bookings/${b.id}`)).json<Booking>().status).toBe(
      'confirmed',
    );
    clock.set(new Date(new Date(T10).getTime() + 30 * MIN));
    expect((await jobs.runOnce()).noShows).toBeGreaterThanOrEqual(1);
    const after = (await call(alice, 'GET', `/v1/bookings/${b.id}`)).json<Booking>();
    expect(after.status).toBe('no_show');
    expect(after.refund).toBeNull();
    clock.set(START);
    expect((await book(bob, w, '2030-01-07T05:00:00Z', 30)).statusCode).toBe(201); // the unit is free again
  });

  it('J-5 the outbox is delivered once, failures are retried with a delay', async () => {
    const dispatcher = app.app.get(OutboxDispatcher);
    let attempts = 0;
    dispatcher.register('test.ping', async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('mail server down');
    });
    await database.pool.query(
      `INSERT INTO outbox_events (type, payload, created_at, available_at) VALUES ('test.ping', '{}', $1, $1)`,
      [clock.now()],
    );
    await drain();
    expect(attempts).toBe(1);
    const failed = await rows(
      `SELECT attempts, last_error, processed_at FROM outbox_events WHERE type = 'test.ping'`,
    );
    expect(failed[0]).toMatchObject({
      attempts: 1,
      last_error: 'mail server down',
      processed_at: null,
    });

    await drain(); // too early: the retry is 30 s away
    expect(attempts).toBe(1);
    clock.advance(31_000);
    await drain();
    expect(attempts).toBe(2);
    expect(
      (await rows(`SELECT processed_at FROM outbox_events WHERE type = 'test.ping'`))[0]
        .processed_at,
    ).not.toBeNull();
    await drain();
    expect(attempts).toBe(2); // delivered events are never delivered again
    // everything the booking tests produced was delivered as well
    expect(
      await count(
        `SELECT count(*) AS n FROM outbox_events WHERE processed_at IS NULL AND available_at <= $1`,
        [clock.now()],
      ),
    ).toBe(0);
  });
});

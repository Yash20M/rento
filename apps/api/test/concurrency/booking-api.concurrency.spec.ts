import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BookingJobs } from '../../src/modules/booking';
import { makeSuperAdmin } from '../support/access';
import { createFactories, type Factories } from '../factories';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { ROUNDS, findOverlaps } from '../support/concurrency';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeClock } from '../support/fake-clock';

/**
 * HTTP-level concurrency (README §16): real parallel requests against the real application and a real PostgreSQL.
 * Whatever the interleaving, the database must end up consistent and nobody may see a 5xx or a false conflict.
 */

const START = '2030-01-07T03:00:00Z';
const MIN = 60_000;
const PASSWORD = 'correct horse battery staple';

interface Customer {
  accessToken: string;
  userId: string;
}
interface Problem {
  code: string;
}
interface Booking {
  id: string;
  assetCode: string;
  status: string;
}

let database: TestDatabase;
let app: TestApp;
let clock: FakeClock;
let f: Factories;
let jobs: BookingJobs;
let customers: Customer[] = [];
let counter = 0;

beforeAll(async () => {
  database = await createTestDatabase();
  f = createFactories(database.db);
  clock = new FakeClock(START);
  app = await createTestApp({ config: testConfig({ DATABASE_URL: database.url }), clock });
  jobs = app.app.get(BookingJobs);
  customers = await Promise.all(
    Array.from({ length: 30 }, async (_, i) => {
      const res = await app.app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: { email: `k-${i}-${Date.now()}@example.com`, password: PASSWORD, name: 'K' },
      });
      const body = res.json<{ accessToken: string; user: { id: string } }>();
      return { accessToken: body.accessToken, userId: body.user.id };
    }),
  );
}, 120_000);
afterAll(async () => {
  await app.app.close();
  await database.drop();
});

interface World {
  drawerId: string;
  modelId: string;
  assetIds: string[];
}
async function world(assets: number, buffer = 0): Promise<World> {
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
    buffer_min: buffer,
    price_per_slot_paise: 4900,
  });
  const assetIds: string[] = [];
  for (let i = 1; i <= assets; i += 1) {
    assetIds.push(
      (
        await f.asset({
          drawer_id: drawer.id,
          item_model_id: model.id,
          asset_code: `K-${(counter += 1)}-${i}`,
        })
      ).id,
    );
  }
  return { drawerId: drawer.id, modelId: model.id, assetIds };
}

const book = (
  who: Customer,
  w: World,
  startsAt: string,
  minutes: number,
  key = `k-${(counter += 1)}-${Date.now()}-${Math.random()}`,
) =>
  app.app.inject({
    method: 'POST',
    url: '/v1/bookings',
    headers: { authorization: `Bearer ${who.accessToken}`, 'idempotency-key': key },
    payload: { drawerId: w.drawerId, itemModelId: w.modelId, startsAt, durationMinutes: minutes },
  });

type Res = Awaited<ReturnType<typeof book>>;
const summarise = (results: Res[]) => ({
  created: results.filter((r) => r.statusCode === 201),
  taken: results.filter(
    (r) => r.statusCode === 409 && r.json<Problem>().code === 'BOOKING_SLOT_TAKEN',
  ),
  other: results.filter(
    (r) =>
      r.statusCode !== 201 &&
      !(r.statusCode === 409 && r.json<Problem>().code === 'BOOKING_SLOT_TAKEN'),
  ),
});

/** After every scenario: the ledger agrees with the bookings and nothing overlaps (independent SQL). */
async function expectConsistent(w: World, expectedLive: number): Promise<void> {
  expect(await findOverlaps(database.pool), 'no two live occupancies may overlap').toEqual([]);
  const live = await database.pool.query(
    `SELECT count(*)::int AS n FROM asset_occupancies WHERE released_at IS NULL AND asset_id = ANY($1::uuid[])`,
    [w.assetIds],
  );
  expect(live.rows[0].n, 'live occupancies').toBe(expectedLive);
  const orphans = await database.pool.query(
    `SELECT b.id FROM bookings b
      WHERE b.drawer_id = $1 AND b.status IN ('held','confirmed','active','overdue')
        AND (SELECT count(*) FROM asset_occupancies o WHERE o.booking_id = b.id AND o.released_at IS NULL) <> 1`,
    [w.drawerId],
  );
  expect(orphans.rows, 'every live booking holds exactly one live occupancy').toEqual([]);
  const ghosts = await database.pool.query(
    `SELECT id FROM bookings WHERE drawer_id = $1 AND status = 'held'
        AND id NOT IN (SELECT booking_id FROM asset_occupancies WHERE booking_id IS NOT NULL AND released_at IS NULL)`,
    [w.drawerId],
  );
  expect(ghosts.rows, 'losers leave no booking behind').toEqual([]);
}

const rounds = Array.from({ length: Math.min(ROUNDS, 5) }, (_, i) => i + 1);

describe.each(rounds)('concurrent bookings over HTTP — round %i', (round) => {
  it(`K-1 [${round}] 30 customers want the same slot of ONE unit ⇒ exactly one 201, 29 × 409`, async () => {
    const w = await world(1);
    const results = await Promise.all(customers.map((c) => book(c, w, '2030-01-07T05:00:00Z', 60)));
    const { created, taken, other } = summarise(results);
    expect(other.map((r) => `${r.statusCode} ${r.body}`)).toEqual([]);
    expect(created).toHaveLength(1);
    expect(taken).toHaveLength(29);
    await expectConsistent(w, 1);
  });

  it(`K-2 [${round}] 30 customers, a pool of THREE units ⇒ 3 × 201 on three different units`, async () => {
    const w = await world(3);
    const results = await Promise.all(customers.map((c) => book(c, w, '2030-01-07T05:00:00Z', 60)));
    const { created, taken, other } = summarise(results);
    expect(other.map((r) => `${r.statusCode} ${r.body}`)).toEqual([]);
    // On a failure show WHAT was created (units, states, ledger), not just a count.
    const ledger = await database.pool.query(
      `SELECT a.asset_code, b.status, o.released_at IS NOT NULL AS released, b.hold_expires_at
         FROM bookings b JOIN assets a ON a.id = b.asset_id
         LEFT JOIN asset_occupancies o ON o.booking_id = b.id
        WHERE b.drawer_id = $1 ORDER BY a.asset_code, b.created_at`,
      [w.drawerId],
    );
    expect(
      created,
      JSON.stringify({ clock: clock.now().toISOString(), ledger: ledger.rows }),
    ).toHaveLength(3);
    expect(taken).toHaveLength(27);
    expect(new Set(created.map((r) => r.json<Booking>().assetCode)).size).toBe(3);
    await expectConsistent(w, 3);
  });

  it(`K-3 [${round}] ten customers book TEN DIFFERENT, back-to-back slots of one unit ⇒ all succeed (no false conflicts)`, async () => {
    const w = await world(1, 0);
    const base = new Date('2030-01-07T05:00:00Z').getTime();
    const results = await Promise.all(
      customers
        .slice(0, 10)
        .map((c, i) => book(c, w, new Date(base + i * 30 * MIN).toISOString(), 30)),
    );
    const { created, other } = summarise(results);
    expect(other.map((r) => `${r.statusCode} ${r.body}`)).toEqual([]);
    expect(created).toHaveLength(10);
    await expectConsistent(w, 10);
  });

  it(`K-4 [${round}] staggered overlapping requests on one unit: the winners never overlap and nobody sees a 5xx`, async () => {
    const w = await world(1, 0);
    const base = new Date('2030-01-07T05:00:00Z').getTime();
    const results = await Promise.all(
      customers
        .slice(0, 20)
        .map((c, i) => book(c, w, new Date(base + (i % 7) * 15 * MIN).toISOString(), 60)),
    );
    const { created, other } = summarise(results);
    expect(other.map((r) => `${r.statusCode} ${r.body}`)).toEqual([]);
    expect(created.length).toBeGreaterThanOrEqual(1);
    await expectConsistent(w, created.length);
  });

  it(`K-5 [${round}] one holder cancels while three others try to take the slot ⇒ at most one of them gets it`, async () => {
    const w = await world(1);
    const holder = customers[0]!;
    const first = await book(holder, w, '2030-01-07T05:00:00Z', 60);
    expect(first.statusCode).toBe(201);
    const id = first.json<Booking>().id;
    const [cancel, ...rivals] = await Promise.all([
      app.app.inject({
        method: 'POST',
        url: `/v1/bookings/${id}/cancel`,
        headers: { authorization: `Bearer ${holder.accessToken}` },
      }),
      ...customers.slice(1, 4).map((c) => book(c, w, '2030-01-07T05:00:00Z', 60)),
    ]);
    expect(cancel.statusCode).toBe(200);
    const { created, other } = summarise(rivals);
    expect(other.map((r) => `${r.statusCode} ${r.body}`)).toEqual([]);
    expect(created.length).toBeLessThanOrEqual(1);
    await expectConsistent(w, created.length);
    // and once everything has settled the slot is either taken by exactly that rival or free for a new request
    const late = await book(customers[5]!, w, '2030-01-07T05:00:00Z', 60);
    expect(late.statusCode).toBe(created.length === 1 ? 409 : 201);
  });

  it(`K-6 [${round}] a payment arrives at the same moment the sweep expires the hold ⇒ the booking ends up confirmed, never half-way`, async () => {
    const w = await world(1);
    const owner = customers[0]!;
    const held = (await book(owner, w, '2030-01-07T05:00:00Z', 60)).json<Booking>();
    const auth = { authorization: `Bearer ${owner.accessToken}` };
    const order = await app.app.inject({
      method: 'POST',
      url: `/v1/bookings/${held.id}/payment`,
      headers: auth,
    });
    expect(order.statusCode).toBe(200);
    const checkout = (
      await app.app.inject({
        method: 'POST',
        url: `/v1/bookings/${held.id}/payment/simulate`,
        headers: auth,
      })
    ).json<Record<string, string>>();

    clock.advance(11 * MIN); // the hold has run out, but the payment is already in flight
    const [confirm] = await Promise.all([
      app.app.inject({
        method: 'POST',
        url: `/v1/bookings/${held.id}/payment/confirm`,
        headers: auth,
        payload: checkout,
      }),
      jobs.runOnce(),
      jobs.runOnce(),
    ]);
    clock.set(START);
    expect(confirm.statusCode, confirm.body).toBe(200);
    expect(confirm.json<Booking>().status).toBe('confirmed');
    await expectConsistent(w, 1);
    const events = await database.pool.query(
      `SELECT to_status FROM booking_events WHERE booking_id = $1 ORDER BY to_status`,
      [held.id],
    );
    expect(events.rows.map((r) => r.to_status)).toContain('confirmed');
  });

  it(`K-7 [${round}] 20 retries with 5 keys ⇒ five bookings, every retry gets its original answer or "in progress"`, async () => {
    const w = await world(5);
    const owner = customers[0]!;
    const keys = Array.from({ length: 5 }, (_, i) => `retry-${round}-${i}-${Date.now()}`);
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        book(owner, w, '2030-01-07T05:00:00Z', 60, keys[i % 5]!),
      ),
    );
    const created = results.filter((r) => r.statusCode === 201);
    expect(created).toHaveLength(5);
    for (const r of results.filter((x) => x.statusCode !== 201)) {
      if (r.statusCode === 409) expect(r.json<Problem>().code).toBe('REQUEST_IN_PROGRESS');
      else expect(r.statusCode).toBe(200);
    }
    const n = await database.pool.query(
      `SELECT count(*)::int AS n FROM bookings WHERE drawer_id = $1`,
      [w.drawerId],
    );
    expect(n.rows[0].n).toBe(5);
    await expectConsistent(w, 5);
  });

  it(`K-8 [${round}] an admin blocks the unit while ten customers book the same window ⇒ either the block or one booking wins, never both`, async () => {
    const w = await world(1);
    const admin = customers[29]!;
    await makeSuperAdmin(database.pool, admin.userId);
    const [from, to] = ['2030-01-07T05:00:00Z', '2030-01-07T06:00:00Z'];
    const [blockRes, ...bookings] = await Promise.all([
      app.app.inject({
        method: 'POST',
        url: `/v1/admin/assets/${w.assetIds[0]}/blocks`,
        headers: { authorization: `Bearer ${admin.accessToken}` },
        payload: { startsAt: from, endsAt: to, reason: 'Race' },
      }),
      ...customers.slice(0, 10).map((c) => book(c, w, from!, 60)),
    ]);
    const { created, other } = summarise(bookings);
    expect(other.map((r) => `${r.statusCode} ${r.body}`)).toEqual([]);
    expect([201, 409]).toContain(blockRes.statusCode);
    if (blockRes.statusCode === 201) expect(created).toHaveLength(0);
    else expect(created).toHaveLength(1);
    await expectConsistent(w, 1);
  });

  it(`K-9 [${round}] a running rental is extended while ten customers book right after it ⇒ the extension or one booking wins, never both`, async () => {
    const w = await world(1);
    const authed = (who: Customer) => ({ authorization: `Bearer ${who.accessToken}` });
    const register = async (tag: string): Promise<Customer & { email: string }> => {
      const email = `k9-${tag}-${(counter += 1)}-${Date.now()}@example.com`;
      const res = await app.app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: { email, password: PASSWORD, name: 'K9' },
      });
      const body = res.json<{ accessToken: string; user: { id: string } }>();
      return { accessToken: body.accessToken, userId: body.user.id, email };
    };
    const start = '2030-01-07T05:00:00Z';
    const renter = await register('renter');
    const held = (await book(renter, w, start, 60)).json<Booking>();
    await app.app.inject({
      method: 'POST',
      url: `/v1/bookings/${held.id}/payment`,
      headers: authed(renter),
    });
    const checkout = (
      await app.app.inject({
        method: 'POST',
        url: `/v1/bookings/${held.id}/payment/simulate`,
        headers: authed(renter),
      })
    ).json();
    const paid = await app.app.inject({
      method: 'POST',
      url: `/v1/bookings/${held.id}/payment/confirm`,
      headers: authed(renter),
      payload: checkout,
    });
    expect(paid.statusCode, paid.body).toBe(200);
    clock.set(start);
    try {
      // access tokens follow the (moved) clock: sign everyone in afresh at the new time
      const login = await app.app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: renter.email, password: PASSWORD },
      });
      renter.accessToken = login.json<{ accessToken: string }>().accessToken;
      const admin = await register('admin');
      await makeSuperAdmin(database.pool, admin.userId);
      const others = await Promise.all(Array.from({ length: 10 }, (_, i) => register(`b${i}`)));

      const pickup = await app.app.inject({
        method: 'POST',
        url: `/v1/admin/bookings/${held.id}/pickup`,
        headers: authed(admin),
      });
      expect(pickup.statusCode, pickup.body).toBe(200);

      // asking for more time only quotes it; the unit is claimed when the extra time is PAID — race that moment
      const quote = await app.app.inject({
        method: 'POST',
        url: `/v1/bookings/${held.id}/extend`,
        headers: authed(renter),
        payload: { extraMinutes: 30 },
      });
      expect(quote.statusCode, quote.body).toBe(201);
      const ext = quote.json<{ id: string }>();
      const ticket = (
        await app.app.inject({
          method: 'POST',
          url: `/v1/bookings/${held.id}/extensions/${ext.id}/simulate`,
          headers: authed(renter),
        })
      ).json();
      const [extension, ...next] = await Promise.all([
        app.app.inject({
          method: 'POST',
          url: `/v1/bookings/${held.id}/extensions/${ext.id}/confirm`,
          headers: authed(renter),
          payload: ticket,
        }),
        ...others.map((c) => book(c, w, '2030-01-07T06:00:00Z', 60)),
      ]);
      const { created, other } = summarise(next);
      expect(other.map((r) => `${r.statusCode} ${r.body}`)).toEqual([]);
      expect(extension.statusCode, extension.body).toBeLessThan(500);
      // the extra time covers 06:00–06:30 of the same unit: it and a booking at 06:00 can never both exist
      expect(created).toHaveLength(extension.statusCode === 200 ? 0 : 1);
      await expectConsistent(w, 1 + created.length);
    } finally {
      clock.set(START);
    }
  });
});

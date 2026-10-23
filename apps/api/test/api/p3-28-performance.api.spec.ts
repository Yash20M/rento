import { writeFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createFactories, type Factories } from '../factories';
import { makeSuperAdmin } from '../support/access';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { registerSession, type TestSession } from '../support/sessions';

/**
 * P3-28 — baseline numbers for the reads the apps depend on, against a database with real volume: 10 000 bookings,
 * 2 000 customers and 60 drawers. Each read is timed 20 times; the 95th percentile must stay under a generous limit
 * (several times what a laptop shows today), so a missing index or an N+1 shows up as a failure, not as a slow screen.
 * The measured numbers are printed and recorded in docs/performance.md.
 */
const BOOKINGS = 10_000;
const CUSTOMERS = 2_000;
const DRAWERS = 60;
const RUNS = 20;

let database: TestDatabase;
let app: TestApp;
let f: Factories;
let admin: TestSession;
let customer: TestSession;
let someDrawer = '';
let someModel = '';

beforeAll(async () => {
  database = await createTestDatabase();
  f = createFactories(database.db);
  app = await createTestApp({ config: testConfig({ DATABASE_URL: database.url }) });
  admin = await registerSession(app, { now: () => new Date() } as never, 'perf-admin');
  await makeSuperAdmin(database.pool, admin.user.id);
  customer = await registerSession(app, { now: () => new Date() } as never, 'perf-customer');

  const model = await f.itemModel({
    slot_minutes: 30,
    min_duration_min: 30,
    max_duration_min: 240,
  });
  someModel = model.id;
  const assetIds: Array<{ id: string; drawer: string }> = [];
  for (let i = 0; i < DRAWERS; i += 1) {
    const drawer = await f.drawer({ name: `Perf Hub ${i}` });
    if (i === 0) someDrawer = drawer.id;
    for (let weekday = 1; weekday <= 7; weekday += 1) {
      await database.pool.query(
        `INSERT INTO drawer_hours (drawer_id, weekday, opens_at, closes_at) VALUES ($1, $2, '08:00', '22:00')`,
        [drawer.id, weekday],
      );
    }
    for (let k = 0; k < 3; k += 1) {
      const asset = await f.asset({ drawer_id: drawer.id, item_model_id: model.id });
      assetIds.push({ id: asset.id, drawer: drawer.id });
    }
  }

  // customers and bookings in bulk (plain SQL: the point is volume, not the application path)
  await database.pool.query(
    `INSERT INTO users (email, display_name, status)
       SELECT 'bulk-' || g || '@example.com', 'Bulk Customer ' || g, 'active' FROM generate_series(1, $1) g`,
    [CUSTOMERS],
  );
  await database.pool.query(
    `INSERT INTO bookings (user_id, asset_id, drawer_id, item_model_id, status, starts_at, ends_at, price_paise)
       SELECT u.id, a.id, a.drawer_id, a.item_model_id,
              (ARRAY['completed','cancelled','completed','completed'])[1 + (g % 4)],
              timestamptz '2029-01-01 00:00+00' + (g * interval '50 minutes'),
              timestamptz '2029-01-01 01:00+00' + (g * interval '50 minutes'),
              4900
         FROM generate_series(1, $1) g
         JOIN LATERAL (SELECT id FROM users WHERE email LIKE 'bulk-%' ORDER BY id OFFSET (g % $2) LIMIT 1) u ON true
         JOIN LATERAL (SELECT id, drawer_id, item_model_id FROM assets ORDER BY id OFFSET (g % $3) LIMIT 1) a ON true`,
    [BOOKINGS, CUSTOMERS, assetIds.length],
  );
  await database.pool.query('ANALYZE');
}, 300_000);
afterAll(async () => {
  await app.app.close();
  await database.drop();
});

const results: Array<{ name: string; p50: number; p95: number; limit: number }> = [];

async function measure(
  name: string,
  limitMs: number,
  request: () => Promise<{ statusCode: number }>,
): Promise<void> {
  await request(); // warm-up (plans, connections)
  const times: number[] = [];
  for (let i = 0; i < RUNS; i += 1) {
    const started = performance.now();
    const res = await request();
    times.push(performance.now() - started);
    expect(res.statusCode, name).toBe(200);
  }
  times.sort((a, b) => a - b);
  const p50 = times[Math.floor(RUNS * 0.5)]!;
  const p95 = times[Math.floor(RUNS * 0.95) - 1]!;
  results.push({ name, p50, p95, limit: limitMs });
  expect(p95, `${name}: p95 ${p95.toFixed(0)} ms, limit ${limitMs} ms`).toBeLessThan(limitMs);
}

const get = (token: string, url: string) =>
  app.app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}` } });

describe(`reads with ${BOOKINGS} bookings, ${CUSTOMERS} customers, ${DRAWERS} drawers`, () => {
  it('R-0 the volume is really there', async () => {
    const n = await database.pool.query(
      'SELECT (SELECT count(*) FROM bookings)::int AS bookings, (SELECT count(*) FROM users)::int AS users, (SELECT count(*) FROM drawers)::int AS drawers',
    );
    expect(n.rows[0].bookings).toBe(BOOKINGS);
    expect(n.rows[0].users).toBeGreaterThanOrEqual(CUSTOMERS);
    expect(n.rows[0].drawers).toBe(DRAWERS);
  });

  it('R-1 admin bookings list (first page, filtered page, deep page)', async () => {
    await measure('admin bookings, first page', 400, () =>
      get(admin.accessToken, '/v1/admin/bookings?limit=25'),
    );
    await measure('admin bookings, status filter', 400, () =>
      get(admin.accessToken, '/v1/admin/bookings?limit=25&status=cancelled'),
    );
    await measure('admin bookings, one drawer', 400, () =>
      get(admin.accessToken, `/v1/admin/bookings?limit=25&drawerId=${someDrawer}`),
    );
  });

  it('R-2 admin customers list and search', async () => {
    await measure('admin customers, first page', 400, () =>
      get(admin.accessToken, '/v1/admin/customers?limit=25'),
    );
    await measure('admin customers, search', 400, () =>
      get(admin.accessToken, '/v1/admin/customers?limit=25&q=bulk-17'),
    );
  });

  it('R-3 dashboard, report and payments ledger', async () => {
    await measure('dashboard', 600, () => get(admin.accessToken, '/v1/admin/dashboard'));
    await measure('report, 90 days', 600, () =>
      get(
        admin.accessToken,
        '/v1/admin/reports/summary?from=2029-01-01T00:00:00Z&to=2029-04-01T00:00:00Z',
      ),
    );
    await measure('payments ledger', 400, () =>
      get(admin.accessToken, '/v1/admin/payments?limit=25'),
    );
  });

  it('R-4 what a customer sees: nearby drawers, drawer stock, availability', async () => {
    await measure('nearby (60 drawers, with a product)', 600, () =>
      app.app.inject({
        method: 'POST',
        url: '/v1/drawers/nearby',
        headers: { authorization: `Bearer ${customer.accessToken}` },
        payload: { latitude: 12.9716, longitude: 77.5946, itemModelId: someModel },
      }),
    );
    await measure('drawer stock list', 400, () =>
      get(customer.accessToken, `/v1/drawers/${someDrawer}/inventory`),
    );
    const day = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    await measure('availability for a day', 600, () =>
      get(
        customer.accessToken,
        `/v1/drawers/${someDrawer}/items/${someModel}/availability?date=${day}`,
      ),
    );
  });

  it('R-5 the numbers, for the record', () => {
    const lines = results.map(
      (r) =>
        `${r.name.padEnd(42)} p50 ${r.p50.toFixed(0).padStart(4)} ms   p95 ${r.p95.toFixed(0).padStart(4)} ms   (limit ${r.limit})`,
    );
    // The runner hides console output: PERF_OUT=<file> writes the table for docs/performance.md.
    const out = process.env['PERF_OUT'];
    if (out) writeFileSync(out, `${lines.join('\n')}\n`);
    expect(results.length).toBeGreaterThan(8);
  });
});

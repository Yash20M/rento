import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { grantPermissions, makeSuperAdmin } from '../support/access';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeClock } from '../support/fake-clock';
import { type TestSession, registerSession } from '../support/sessions';

/** P2-19 — the discovery rules an operator can change: bounds, permission, immediate effect, audit row. */
const START = '2030-01-07T03:00:00Z'; // Monday 08:30 in Asia/Kolkata
const ORIGIN = { latitude: 28.6139, longitude: 77.209 };
const URL = '/v1/admin/settings/discovery';

let database: TestDatabase;
let app: TestApp;
let clock: FakeClock;
let boss: TestSession;
let reader: TestSession;
let writer: TestSession;

beforeAll(async () => {
  database = await createTestDatabase();
  clock = new FakeClock(START);
  app = await createTestApp({ config: testConfig({ DATABASE_URL: database.url }), clock });
  boss = await registerSession(app, clock, 'boss');
  reader = await registerSession(app, clock, 'reader');
  writer = await registerSession(app, clock, 'writer');
  await makeSuperAdmin(database.pool, boss.user.id);
  await grantPermissions(database.pool, reader.user.id, ['settings:read']);
  await grantPermissions(database.pool, writer.user.id, ['settings:read', 'settings:write']);
  for (const [i, lat] of [28.6139, 28.6239, 28.6339, 28.6539, 28.7039].entries()) {
    const res = await call(boss, 'POST', '/v1/admin/drawers', {
      name: `Spot ${i}`,
      address: '1 Test Street',
      timezone: 'Asia/Kolkata',
      latitude: lat,
      longitude: ORIGIN.longitude,
      hours: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
        weekday,
        opensAt: '08:00',
        closesAt: '22:00',
      })),
    });
    expect(res.statusCode).toBe(201);
  }
});
afterAll(async () => {
  await app.app.close();
  await database.drop();
});

const call = (
  who: TestSession | undefined,
  method: 'GET' | 'POST' | 'PUT',
  url: string,
  payload?: object,
) =>
  app.app.inject({
    method,
    url,
    ...(who && { headers: { authorization: `Bearer ${who.accessToken}` } }),
    ...(payload !== undefined && { payload }),
  });
const nearby = async () =>
  (await call(undefined, 'POST', '/v1/drawers/nearby', ORIGIN)).json<{
    drawers: Array<{ name: string }>;
  }>().drawers;

describe('discovery settings', () => {
  it('D-1 starts from the deployment values (radius 5 km, 3 results)', async () => {
    const res = await call(reader, 'GET', URL);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ radiusMeters: 5000, maxResults: 3 });
    expect((await nearby()).map((d) => d.name)).toEqual(['Spot 0', 'Spot 1', 'Spot 2']);
  });

  it('D-2 permissions: no token 401, read-only 403 on save, settings:write 200', async () => {
    expect((await call(undefined, 'GET', URL)).statusCode).toBe(401);
    expect(
      (await call(undefined, 'PUT', URL, { radiusMeters: 1000, maxResults: 2 })).statusCode,
    ).toBe(401);
    const denied = await call(reader, 'PUT', URL, { radiusMeters: 1000, maxResults: 2 });
    expect(denied.statusCode).toBe(403);
    expect(denied.json<{ code: string }>().code).toBe('PERMISSION_DENIED');
    const customer = await registerSession(app, clock, 'customer');
    expect((await call(customer, 'GET', URL)).statusCode).toBe(403);
  });

  it.each([
    [{ radiusMeters: 99, maxResults: 3 }, 'radiusMeters'],
    [{ radiusMeters: 50_001, maxResults: 3 }, 'radiusMeters'],
    [{ radiusMeters: 1000, maxResults: 0 }, 'maxResults'],
    [{ radiusMeters: 1000, maxResults: 11 }, 'maxResults'],
    [{ radiusMeters: 1000.5, maxResults: 3 }, 'radiusMeters'],
    [{ radiusMeters: '1000', maxResults: 3 }, 'radiusMeters'],
    [{ maxResults: 3 }, 'radiusMeters'],
  ])('D-3 %j is refused (422 on %s) and changes nothing', async (body, field) => {
    const res = await call(writer, 'PUT', URL, body);
    expect(res.statusCode).toBe(422);
    expect(res.json<{ errors: Array<{ field: string }> }>().errors.map((e) => e.field)).toContain(
      field,
    );
    expect((await call(reader, 'GET', URL)).json()).toEqual({ radiusMeters: 5000, maxResults: 3 });
  });

  it('D-4 a save applies to the very next search, and the search uses the new radius and count', async () => {
    const saved = await call(writer, 'PUT', URL, { radiusMeters: 1500, maxResults: 1 });
    expect(saved.statusCode).toBe(200);
    expect((await call(reader, 'GET', URL)).json()).toEqual({ radiusMeters: 1500, maxResults: 1 });
    expect((await nearby()).map((d) => d.name)).toEqual(['Spot 0']);

    await call(writer, 'PUT', URL, { radiusMeters: 10_000, maxResults: 5 });
    expect((await nearby()).map((d) => d.name)).toEqual([
      'Spot 0',
      'Spot 1',
      'Spot 2',
      'Spot 3',
      'Spot 4',
    ]);
  });

  it('D-5 the read-only settings page shows the saved values, and each save is audited with before and after', async () => {
    const page = await call(reader, 'GET', '/v1/admin/settings');
    expect(page.json()).toMatchObject({ discoveryRadiusMeters: 10_000, discoveryMaxResults: 5 });
    const rows = (
      await database.pool.query<{ actor_id: string; before: unknown; after: unknown }>(
        `SELECT actor_id, before, after FROM audit_logs WHERE action = 'settings.discovery_updated' ORDER BY at, id`,
      )
    ).rows;
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.actor_id)).toEqual([writer.user.id, writer.user.id]);
    expect(rows.map((r) => r.after)).toEqual(
      expect.arrayContaining([
        { radiusMeters: 10_000, maxResults: 5 },
        { radiusMeters: 1500, maxResults: 1 },
      ]),
    );
    expect(rows.find((r) => (r.after as { maxResults: number }).maxResults === 1)?.before).toEqual({
      radiusMeters: 5000,
      maxResults: 3,
    });
  });
});

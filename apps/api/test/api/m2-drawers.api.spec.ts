import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createFactories, type Factories } from '../factories';
import { grantPermissions, makeSuperAdmin } from '../support/access';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeClock } from '../support/fake-clock';

const PASSWORD = 'correct horse battery staple';
const START = '2030-01-07T03:00:00Z'; // Monday 08:30 in Asia/Kolkata

interface Session {
  accessToken: string;
  user: { id: string };
}
interface Problem {
  code: string;
  errors?: Array<{ field: string; message: string }>;
}
interface Hours {
  weekday: number;
  opensAt: string;
  closesAt: string;
}
interface Drawer {
  id: string;
  name: string;
  timezone: string;
  latitude: number;
  longitude: number;
  status: string;
  hours: Hours[];
  assetCount: number;
}
interface Closure {
  id: string;
  from: string;
  to: string;
  reason: string | null;
}
interface PublicDrawer {
  id: string;
  name: string;
  openNow: boolean;
  distanceMeters?: number;
  availableNow?: number | null;
  reason?: string | null;
}
interface Nearby {
  drawers: PublicDrawer[];
  unavailable: PublicDrawer[];
}
interface Availability {
  date: string;
  timezone: string;
  snapshot: boolean;
  opensAt: string | null;
  closesAt: string | null;
  slots: Array<{ startsAt: string; freeAssets: number; maxFreeMinutes: number }>;
}

let database: TestDatabase;
let app: TestApp;
let clock: FakeClock;
let f: Factories;
let counter = 0;
let boss: Session;
let customer: Session;
let scoped: Session;
let reader: Session;

beforeAll(async () => {
  database = await createTestDatabase();
  f = createFactories(database.db);
  clock = new FakeClock(START);
  app = await createTestApp({ config: testConfig({ DATABASE_URL: database.url }), clock });
  boss = await register();
  customer = await register();
  scoped = await register();
  reader = await register();
  await makeSuperAdmin(database.pool, boss.user.id);
  await grantPermissions(database.pool, reader.user.id, ['drawers:read']);
});
afterAll(async () => {
  await app.app.close();
  await database.drop();
});
async function register(): Promise<Session> {
  const res = await app.app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: {
      email: `m2d-${(counter += 1)}-${Date.now()}@example.com`,
      password: PASSWORD,
      name: 'Tester',
    },
  });
  return res.json<Session>();
}
const unique = (tag: string) => `${tag} ${(counter += 1)}-${Date.now()}`;
const call = (
  who: Session | undefined,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  url: string,
  payload?: Record<string, unknown>,
) =>
  app.app.inject({
    method,
    url,
    ...(who && { headers: { authorization: `Bearer ${who.accessToken}` } }),
    ...(payload !== undefined && { payload }),
  });
const allWeek = (opensAt = '08:00', closesAt = '22:00'): Hours[] =>
  [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, opensAt, closesAt }));
const makeDrawer = async (overrides: Record<string, unknown> = {}) => {
  const res = await call(boss, 'POST', '/v1/admin/drawers', {
    name: unique('Drawer'),
    address: '1 Test Street',
    timezone: 'Asia/Kolkata',
    latitude: 12.9716,
    longitude: 77.5946,
    hours: allWeek(),
    ...overrides,
  });
  return res;
};
const audit = async (entityId: string) =>
  (
    await database.pool.query(
      'SELECT action FROM audit_logs WHERE entity_id = $1 ORDER BY at, id',
      [entityId],
    )
  ).rows
    .map((r) => r.action as string)
    .sort(); // the fake clock gives every row the same instant, so compare as a sorted set

describe('drawer administration', () => {
  it('D-1 create stores longitude FIRST: the point round-trips, and the API reports lat/lng the right way round', async () => {
    const res = await makeDrawer({ latitude: 12.9716, longitude: 77.5946 });
    expect(res.statusCode).toBe(201);
    const drawer = res.json<Drawer>();
    expect(drawer).toMatchObject({
      latitude: 12.9716,
      longitude: 77.5946,
      status: 'active',
      assetCount: 0,
    });
    const stored = (
      await database.pool.query(
        'SELECT ST_X(location::geometry) AS x, ST_Y(location::geometry) AS y FROM drawers WHERE id = $1',
        [drawer.id],
      )
    ).rows[0];
    expect(stored).toEqual({ x: 77.5946, y: 12.9716 }); // x = longitude, y = latitude
    expect(await audit(drawer.id)).toEqual(['drawer.created']);
    expect(drawer.hours).toHaveLength(7);
  });

  it.each([
    ['latitude above 90', { latitude: 91 }],
    ['latitude below −90', { latitude: -90.5 }],
    ['longitude above 180', { longitude: 180.1 }],
    ['non-numeric latitude', { latitude: '12.9' }],
    ['missing coordinates', { latitude: undefined, longitude: undefined }],
    ['IST is not a time zone name', { timezone: 'IST' }],
    ['unknown zone', { timezone: 'Mars/Olympus' }],
    [
      'duplicate weekday',
      { hours: [...allWeek(), { weekday: 1, opensAt: '09:00', closesAt: '10:00' }] },
    ],
    ['closing before opening', { hours: [{ weekday: 1, opensAt: '18:00', closesAt: '09:00' }] }],
    ['closing equals opening', { hours: [{ weekday: 1, opensAt: '09:00', closesAt: '09:00' }] }],
    ['bad time format', { hours: [{ weekday: 1, opensAt: '9am', closesAt: '5pm' }] }],
    ['weekday 8', { hours: [{ weekday: 8, opensAt: '09:00', closesAt: '10:00' }] }],
    ['unknown field', { colour: 'blue' }],
  ])('D-2 %s ⇒ 422 and nothing stored', async (_name, overrides) => {
    const name = unique('Rejected');
    const res = await makeDrawer({ name, ...overrides });
    expect(res.statusCode).toBe(422);
    expect(
      (await database.pool.query('SELECT 1 FROM drawers WHERE name = $1', [name])).rowCount,
    ).toBe(0);
  });

  it('D-3 update changes only what is sent, moves the point as a pair, audits before/after', async () => {
    const drawer = (await makeDrawer()).json<Drawer>();
    const moved = await call(boss, 'PATCH', `/v1/admin/drawers/${drawer.id}`, {
      latitude: 35.6762,
      longitude: 139.6503,
      address: 'New address',
    });
    expect(moved.json<Drawer>()).toMatchObject({
      latitude: 35.6762,
      longitude: 139.6503,
      name: drawer.name,
    });
    expect(
      (await call(boss, 'PATCH', `/v1/admin/drawers/${drawer.id}`, { latitude: 10 })).statusCode,
    ).toBe(422); // pair
    expect(
      (await call(boss, 'PATCH', `/v1/admin/drawers/${drawer.id}`, { timezone: 'Nope/Zone' }))
        .statusCode,
    ).toBe(422);
    expect(await audit(drawer.id)).toEqual(['drawer.created', 'drawer.updated']);
  });

  it('D-4 weekly hours are replaced as a whole; an empty list means always closed', async () => {
    const drawer = (await makeDrawer()).json<Drawer>();
    const res = await call(boss, 'PUT', `/v1/admin/drawers/${drawer.id}/hours`, {
      hours: [
        { weekday: 1, opensAt: '09:00', closesAt: '13:00' },
        { weekday: 3, opensAt: '10:30', closesAt: '18:45' },
      ],
    });
    expect(res.json<Drawer>().hours).toEqual([
      { weekday: 1, opensAt: '09:00', closesAt: '13:00' },
      { weekday: 3, opensAt: '10:30', closesAt: '18:45' },
    ]);
    expect(
      (
        await call(boss, 'PUT', `/v1/admin/drawers/${drawer.id}/hours`, { hours: [] })
      ).json<Drawer>().hours,
    ).toEqual([]);
    expect(await audit(drawer.id)).toEqual([
      'drawer.created',
      'drawer.hours_set',
      'drawer.hours_set',
    ]);
  });

  it('D-5 closures: add, list, overlap refused, remove; to must be after from', async () => {
    const drawer = (await makeDrawer()).json<Drawer>();
    const add = (from: string, to: string) =>
      call(boss, 'POST', `/v1/admin/drawers/${drawer.id}/closures`, {
        from,
        to,
        reason: 'Holiday',
      });
    const first = await add('2030-02-01T00:00:00Z', '2030-02-03T00:00:00Z');
    expect(first.statusCode).toBe(201);
    expect(first.json<Closure>()).toMatchObject({
      from: '2030-02-01T00:00:00.000Z',
      to: '2030-02-03T00:00:00.000Z',
      reason: 'Holiday',
    });
    expect((await add('2030-02-02T00:00:00Z', '2030-02-04T00:00:00Z')).statusCode).toBe(422); // overlaps
    expect((await add('2030-02-03T00:00:00Z', '2030-02-04T00:00:00Z')).statusCode).toBe(201); // adjacent is fine
    expect((await add('2030-03-05T00:00:00Z', '2030-03-05T00:00:00Z')).statusCode).toBe(422); // empty
    expect((await add('2030-03-06T00:00:00Z', '2030-03-05T00:00:00Z')).statusCode).toBe(422); // backwards
    expect(
      (await call(reader, 'GET', `/v1/admin/drawers/${drawer.id}/closures`)).json<Closure[]>(),
    ).toHaveLength(2);
    expect(
      (
        await call(
          boss,
          'DELETE',
          `/v1/admin/drawers/${drawer.id}/closures/${first.json<Closure>().id}`,
        )
      ).statusCode,
    ).toBe(204);
    expect(
      (
        await call(
          boss,
          'DELETE',
          `/v1/admin/drawers/${drawer.id}/closures/${first.json<Closure>().id}`,
        )
      ).statusCode,
    ).toBe(404);
    expect((await add('2030-02-02T00:00:00Z', '2030-02-02T12:00:00Z')).statusCode).toBe(201); // free again
  });

  it('D-6 setting a drawer inactive with upcoming bookings ⇒ 409 HAS_FUTURE_BOOKINGS; temporarily_closed is allowed', async () => {
    const drawer = (await makeDrawer()).json<Drawer>();
    const asset = await f.asset({ drawer_id: drawer.id });
    await f.booking({
      asset_id: asset.id,
      starts_at: '2099-01-01T10:00:00Z',
      ends_at: '2099-01-01T11:00:00Z',
    });
    const blocked = await call(boss, 'PATCH', `/v1/admin/drawers/${drawer.id}`, {
      status: 'inactive',
    });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json<Problem>().code).toBe('HAS_FUTURE_BOOKINGS');
    expect(
      (
        await call(boss, 'PATCH', `/v1/admin/drawers/${drawer.id}`, {
          status: 'temporarily_closed',
        })
      ).statusCode,
    ).toBe(200);
  });

  it('D-7 a drawer-limited admin sees and edits only their drawer; cannot create drawers', async () => {
    const mine = (await makeDrawer()).json<Drawer>();
    const theirs = (await makeDrawer()).json<Drawer>();
    await grantPermissions(
      database.pool,
      scoped.user.id,
      ['drawers:read', 'drawers:write'],
      mine.id,
    );

    expect(
      (await call(scoped, 'GET', '/v1/admin/drawers')).json<Drawer[]>().map((d) => d.id),
    ).toEqual([mine.id]);
    expect((await call(scoped, 'GET', `/v1/admin/drawers/${theirs.id}`)).statusCode).toBe(404);
    expect(
      (await call(scoped, 'PATCH', `/v1/admin/drawers/${theirs.id}`, { name: 'Hacked' }))
        .statusCode,
    ).toBe(404);
    expect(
      (await call(scoped, 'PUT', `/v1/admin/drawers/${theirs.id}/hours`, { hours: [] })).statusCode,
    ).toBe(404);
    expect(
      (
        await call(scoped, 'POST', `/v1/admin/drawers/${theirs.id}/closures`, {
          from: '2030-05-01T00:00:00Z',
          to: '2030-05-02T00:00:00Z',
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await call(scoped, 'PATCH', `/v1/admin/drawers/${mine.id}`, { name: 'Renamed by me' }))
        .statusCode,
    ).toBe(200);
    expect((await call(boss, 'GET', `/v1/admin/drawers/${theirs.id}`)).json<Drawer>().name).toBe(
      theirs.name,
    );

    const create = await call(scoped, 'POST', '/v1/admin/drawers', {
      name: 'New',
      address: 'x',
      timezone: 'Asia/Kolkata',
      latitude: 1,
      longitude: 1,
    });
    expect(create.statusCode).toBe(403);
    expect(create.json<Problem>().code).toBe('PERMISSION_DENIED');
  });

  it('D-8 matrix: customers and no-token callers are refused', async () => {
    for (const [method, url] of [
      ['GET', '/v1/admin/drawers'],
      ['POST', '/v1/admin/drawers'],
    ] as const) {
      expect(
        (await call(undefined, method, url, method === 'POST' ? {} : undefined)).statusCode,
      ).toBe(401);
      expect(
        (await call(customer, method, url, method === 'POST' ? {} : undefined)).statusCode,
      ).toBe(403);
    }
  });
});

describe('nearby discovery (Delhi cluster)', () => {
  // Latitude step 0.01° ≈ 1.11 km, so drawers sit about 0, 1.1, 2.2, 4.4 km north of the search point, one far away.
  const ORIGIN = { latitude: 28.6139, longitude: 77.209 };
  const ids: Record<string, string> = {};
  let modelId: string;

  beforeAll(async () => {
    const at = async (
      key: string,
      latitude: number,
      longitude = ORIGIN.longitude,
      extra: Record<string, unknown> = {},
    ) => {
      const res = await makeDrawer({ name: `Delhi ${key}`, latitude, longitude, ...extra });
      expect(res.statusCode).toBe(201);
      ids[key] = res.json<Drawer>().id;
    };
    await at('d0', 28.6139);
    await at('d1', 28.6239);
    await at('d2', 28.6339);
    await at('d4', 28.6539);
    await at('far', 28.9, 77.3); // ~32 km away
    const category = await f.category();
    modelId = (await f.itemModel({ category_id: category.id })).id;
  });

  const nearby = (extra: Record<string, unknown> = {}) =>
    call(undefined, 'POST', '/v1/drawers/nearby', { ...ORIGIN, ...extra });
  const names = (list: PublicDrawer[]) => list.map((d) => d.name);

  it('N-1 returns the nearest open drawers, nearest first, at most 3, with distances', async () => {
    const res = await nearby();
    expect(res.statusCode).toBe(200);
    const body = res.json<Nearby>();
    expect(names(body.drawers)).toEqual(['Delhi d0', 'Delhi d1', 'Delhi d2']);
    expect(body.drawers.map((d) => d.distanceMeters)).toEqual([
      0,
      expect.any(Number),
      expect.any(Number),
    ]);
    expect(body.drawers[1]!.distanceMeters!).toBeGreaterThan(1000);
    expect(body.drawers[1]!.distanceMeters!).toBeLessThan(1200);
    expect(body.drawers.every((d) => d.openNow)).toBe(true);
    expect(body.unavailable).toEqual([]);
  });

  it('N-2 a drawer that is closed right now is skipped and explained; the next one is returned', async () => {
    await call(boss, 'POST', `/v1/admin/drawers/${ids['d0']}/closures`, {
      from: '2030-01-07T00:00:00Z',
      to: '2030-01-08T00:00:00Z',
      reason: 'Repairs',
    });
    const body = (await nearby()).json<Nearby>();
    expect(names(body.drawers)).toEqual(['Delhi d1', 'Delhi d2', 'Delhi d4']);
    expect(body.unavailable).toMatchObject([
      { name: 'Delhi d0', reason: 'closed', openNow: false },
    ]);
    const closure = (await call(boss, 'GET', `/v1/admin/drawers/${ids['d0']}/closures`)).json<
      Closure[]
    >()[0]!;
    await call(boss, 'DELETE', `/v1/admin/drawers/${ids['d0']}/closures/${closure.id}`);
  });

  it('N-3 outside opening hours counts as closed; inactive and temporarily closed drawers never appear', async () => {
    await call(boss, 'PUT', `/v1/admin/drawers/${ids['d1']}/hours`, {
      hours: allWeek('09:00', '10:00'),
    }); // clock: 08:30 IST
    await call(boss, 'PATCH', `/v1/admin/drawers/${ids['d2']}`, { status: 'temporarily_closed' });
    const body = (await nearby()).json<Nearby>();
    expect(names(body.drawers)).toEqual(['Delhi d0', 'Delhi d4']);
    expect(body.unavailable).toMatchObject([{ name: 'Delhi d1', reason: 'closed' }]);
    expect([...names(body.drawers), ...names(body.unavailable)]).not.toContain('Delhi d2');
    await call(boss, 'PUT', `/v1/admin/drawers/${ids['d1']}/hours`, { hours: allWeek() });
    await call(boss, 'PATCH', `/v1/admin/drawers/${ids['d2']}`, { status: 'active' });
  });

  it('N-4 with an item model, drawers without a free unit are out_of_stock and skipped', async () => {
    await f.asset({ item_model_id: modelId, drawer_id: ids['d1']! });
    await f.asset({ item_model_id: modelId, drawer_id: ids['d2']! });
    const body = (await nearby({ itemModelId: modelId })).json<Nearby>();
    expect(names(body.drawers)).toEqual(['Delhi d1', 'Delhi d2']);
    expect(body.drawers.map((d) => d.availableNow)).toEqual([1, 1]);
    expect(body.unavailable.map((d) => [d.name, d.reason])).toEqual([
      ['Delhi d0', 'out_of_stock'],
      ['Delhi d4', 'out_of_stock'],
    ]);
  });

  it('N-5 a unit that is busy right now does not count as free', async () => {
    const [{ id: assetId }] = (
      await database.pool.query<{ id: string }>(
        'SELECT id FROM assets WHERE drawer_id = $1 AND item_model_id = $2',
        [ids['d1'], modelId],
      )
    ).rows as [{ id: string }];
    await f.occupancy({
      asset_id: assetId,
      kind: 'maintenance',
      during: '[2030-01-07 02:00+00, 2030-01-07 06:00+00)',
    });
    const body = (await nearby({ itemModelId: modelId })).json<Nearby>();
    expect(names(body.drawers)).toEqual(['Delhi d2']);
    expect(body.unavailable.find((d) => d.name === 'Delhi d1')).toMatchObject({
      reason: 'out_of_stock',
      availableNow: 0,
    });
  });

  it('N-6 nowhere near any drawer ⇒ 422 OUTSIDE_SERVICE_AREA', async () => {
    const res = await nearby({ latitude: -33.8688, longitude: 151.2093 }); // Sydney
    expect(res.statusCode).toBe(422);
    expect(res.json<Problem>().code).toBe('OUTSIDE_SERVICE_AREA');
  });

  it.each([
    ['latitude 91', { latitude: 91 }],
    ['latitude −91', { latitude: -91 }],
    ['longitude 181', { longitude: 181 }],
    ['strings', { latitude: '28.6', longitude: '77.2' }],
    ['missing longitude', { longitude: undefined }],
    ['malformed model id', { itemModelId: 'nope' }],
    ['unknown field', { accuracy: 5 }],
  ])('N-7 %s ⇒ 422', async (_name, overrides) => {
    expect((await nearby(overrides)).statusCode).toBe(422);
  });

  it('N-8 the radius is respected: ~32 km away is outside, and swapping latitude/longitude finds nothing', async () => {
    const swapped = await nearby({ latitude: ORIGIN.longitude, longitude: ORIGIN.latitude });
    expect(swapped.statusCode).toBe(422); // 77.2°N, 28.6°E is nowhere near Delhi
    const near = (await nearby()).json<Nearby>();
    expect([...names(near.drawers), ...names(near.unavailable)]).not.toContain('Delhi far');
  });

  it('N-9 PRIVACY: the coordinates are in no log line and in no table', async () => {
    app.logLines.length = 0;
    await nearby({ latitude: 28.61391234, longitude: 77.20905678 });
    await nearby({ latitude: 28.61391234, longitude: 77.20905678, itemModelId: 'bad' });
    const logs = app.logLines.join('\n');
    expect(logs).not.toContain('28.61391234');
    expect(logs).not.toContain('77.20905678');
    const stored = await database.pool.query(
      `SELECT 1 FROM audit_logs WHERE after::text LIKE '%28.61391234%' OR before::text LIKE '%28.61391234%'`,
    );
    expect(stored.rowCount).toBe(0);
  });

  it('N-10 manual browse lists active drawers with openNow', async () => {
    const list = (await call(undefined, 'GET', '/v1/drawers')).json<PublicDrawer[]>();
    expect(list.map((d) => d.name)).toEqual(expect.arrayContaining(['Delhi d0', 'Delhi far']));
    expect(list.filter((d) => d.name.startsWith('Delhi')).every((d) => d.openNow)).toBe(true);
    await call(boss, 'PATCH', `/v1/admin/drawers/${ids['far']}`, { status: 'inactive' });
    expect(
      (await call(undefined, 'GET', '/v1/drawers')).json<PublicDrawer[]>().map((d) => d.name),
    ).not.toContain('Delhi far');
    await call(boss, 'PATCH', `/v1/admin/drawers/${ids['far']}`, { status: 'active' });
  });
});

describe('inventory & availability snapshot', () => {
  let drawerId: string;
  let modelId: string;
  let a1: string;
  let a2: string;

  beforeAll(async () => {
    clock.set(START);
    drawerId = (
      await makeDrawer({
        name: 'Availability drawer',
        latitude: 19.076,
        longitude: 72.8777,
        hours: [{ weekday: 1, opensAt: '09:00', closesAt: '13:00' }],
      })
    ).json<Drawer>().id;
    const category = await f.category();
    modelId = (
      await f.itemModel({
        category_id: category.id,
        name: 'Availability model',
        price_per_slot_paise: 9900,
        slot_minutes: 60,
        min_duration_min: 60,
        max_duration_min: 180,
        buffer_min: 15,
      })
    ).id;
    a1 = (await f.asset({ item_model_id: modelId, drawer_id: drawerId })).id;
    a2 = (await f.asset({ item_model_id: modelId, drawer_id: drawerId })).id;
    await f.asset({ item_model_id: modelId, drawer_id: drawerId, status: 'maintenance' });
    await f.asset({ item_model_id: modelId, drawer_id: drawerId, status: 'retired' });
    // a1 is blocked 10:00–11:15 local (04:30Z–05:45Z) — a rental plus its 15 min buffer
    await f.occupancy({
      asset_id: a1,
      kind: 'maintenance',
      during: '[2030-01-07 04:30+00, 2030-01-07 05:45+00)',
    });
  });

  const availability = (date = '2030-01-07', drawer = drawerId, model = modelId) =>
    call(undefined, 'GET', `/v1/drawers/${drawer}/items/${model}/availability?date=${date}`);
  const times = (a: Availability) =>
    a.slots.map((s) => new Date(s.startsAt).toISOString().slice(11, 16));
  const slotAt = (a: Availability, utc: string) =>
    a.slots.find((s) => s.startsAt.includes(`T${utc}`));

  it("V-1 the slot grid honours opening hours (local → UTC), the model's slot length and minimum duration", async () => {
    const res = await availability();
    expect(res.statusCode).toBe(200);
    const body = res.json<Availability>();
    expect(body).toMatchObject({ date: '2030-01-07', timezone: 'Asia/Kolkata', snapshot: true });
    expect(body.opensAt).toBe('2030-01-07T03:30:00.000Z'); // 09:00 IST
    expect(body.closesAt).toBe('2030-01-07T07:30:00.000Z'); // 13:00 IST
    expect(times(body)).toEqual(['03:30', '04:30', '05:30', '06:30']); // 09:00, 10:00, 11:00, 12:00 IST (12:00+1h ends at close)
  });

  it('V-2 free units and the longest possible rental per start, with buffers and blocks applied', async () => {
    const body = (await availability()).json<Availability>();
    // a1 is blocked 10:00–11:15 and a1 + buffer overlaps every start up to 11:00; a2 is free all morning.
    expect(slotAt(body, '03:30')).toMatchObject({ freeAssets: 1, maxFreeMinutes: 180 });
    expect(slotAt(body, '04:30')).toMatchObject({ freeAssets: 1, maxFreeMinutes: 180 });
    expect(slotAt(body, '05:30')).toMatchObject({ freeAssets: 1, maxFreeMinutes: 120 });
    expect(slotAt(body, '06:30')).toMatchObject({ freeAssets: 2, maxFreeMinutes: 60 }); // both free; closing time caps it
  });

  it('V-3 the 09:00 start cannot be rented for 60 minutes on a1: its buffer would run into the 10:00 block', async () => {
    const body = (await availability()).json<Availability>();
    expect(slotAt(body, '03:30')!.freeAssets).toBe(1); // only a2, even though a1 looks free at 09:00 itself
  });

  it('V-4 a booking on the other unit takes that unit (and its buffer) out; confirmed vs expired holds', async () => {
    const booking = await f.booking({
      asset_id: a2,
      status: 'confirmed',
      starts_at: '2030-01-07T06:30:00Z',
      ends_at: '2030-01-07T07:30:00Z',
    });
    await f.occupancy({
      asset_id: a2,
      kind: 'booking',
      booking_id: booking.id,
      during: '[2030-01-07 06:30+00, 2030-01-07 07:45+00)',
    });

    let body = (await availability()).json<Availability>();
    expect(slotAt(body, '06:30')).toMatchObject({ freeAssets: 1 }); // a1 only
    // 11:00 is impossible on a2: a one-hour rental plus its 15 min buffer would run into the 12:00 booking
    expect(slotAt(body, '05:30')).toMatchObject({ freeAssets: 0, maxFreeMinutes: 0 });
    // earlier starts on a2 must end 15 min before that booking: 09:00 → 12:00−0:15 = 2h45 → two whole hours
    expect(slotAt(body, '03:30')).toMatchObject({ freeAssets: 1, maxFreeMinutes: 120 });
    expect(slotAt(body, '04:30')).toMatchObject({ freeAssets: 1, maxFreeMinutes: 60 });

    // an abandoned hold whose time ran out but was never released must not block anyone
    const stale = await f.booking({
      asset_id: a1,
      status: 'held',
      starts_at: '2030-01-07T06:30:00Z',
      ends_at: '2030-01-07T07:30:00Z',
      hold_expires_at: '2030-01-07T02:00:00Z',
    });
    await f.occupancy({
      asset_id: a1,
      kind: 'booking',
      booking_id: stale.id,
      during: '[2030-01-07 06:30+00, 2030-01-07 07:45+00)',
    });
    body = (await availability()).json<Availability>();
    expect(slotAt(body, '06:30')!.freeAssets).toBe(1); // still a1 — the expired hold is ignored

    // …but a hold that is still running does
    await database.pool.query(
      `UPDATE bookings SET hold_expires_at = '2030-01-07T09:00:00Z' WHERE id = $1`,
      [stale.id],
    );
    body = (await availability()).json<Availability>();
    expect(slotAt(body, '06:30')!.freeAssets).toBe(0);
  });

  it('V-5 a released occupancy frees the unit again', async () => {
    await database.pool.query(
      'UPDATE asset_occupancies SET released_at = now() WHERE asset_id = $1',
      [a2],
    );
    const body = (await availability()).json<Availability>();
    expect(slotAt(body, '06:30')!.freeAssets).toBe(1 + 0); // a1's running hold still blocks it, a2 is free again
  });

  it('V-6 closures remove slots; the past is not offered', async () => {
    await call(boss, 'POST', `/v1/admin/drawers/${drawerId}/closures`, {
      from: '2030-01-07T05:30:00Z',
      to: '2030-01-07T06:30:00Z',
    });
    let body = (await availability()).json<Availability>();
    expect(times(body)).toContain('04:30');
    expect(slotAt(body, '05:30')).toBeUndefined(); // starts inside the closure: not offered at all
    expect(slotAt(body, '04:30')!.maxFreeMinutes).toBeLessThanOrEqual(60); // a rental may not run into the closure

    clock.set('2030-01-07T05:00:00Z'); // 10:30 IST
    body = (await availability()).json<Availability>();
    expect(times(body)).toEqual(['06:30']); // 09:00 and 10:00 are in the past, 11:00 starts inside the closure
    clock.set(START);
  });

  it('V-7 days without opening hours, and closed drawers, have no slots', async () => {
    const tuesday = (await availability('2030-01-08')).json<Availability>();
    expect(tuesday).toMatchObject({ slots: [], opensAt: null, closesAt: null });
    await call(boss, 'PATCH', `/v1/admin/drawers/${drawerId}`, { status: 'temporarily_closed' });
    expect((await availability()).json<Availability>().slots).toEqual([]);
    await call(boss, 'PATCH', `/v1/admin/drawers/${drawerId}`, { status: 'active' });
  });

  it('V-8 the date must be a real day between today and 90 days ahead', async () => {
    for (const date of ['2030-02-30', 'tomorrow', '2030-1-7', '2029-12-31', '2030-04-08']) {
      expect((await availability(date)).statusCode, date).toBe(422);
    }
    expect((await availability('2030-04-07')).statusCode).toBe(200); // exactly 90 days ahead
  });

  it('V-9 a model the drawer does not offer, an inactive model, an unknown drawer ⇒ 404', async () => {
    const other = await f.itemModel({});
    expect((await availability('2030-01-07', drawerId, other.id)).statusCode).toBe(404);
    expect(
      (await availability('2030-01-07', '00000000-0000-4000-8000-000000000000')).statusCode,
    ).toBe(404);
    expect((await availability('2030-01-07', 'nope')).statusCode).toBe(404);
    await database.pool.query(`UPDATE item_models SET status = 'inactive' WHERE id = $1`, [
      modelId,
    ]);
    expect((await availability()).statusCode).toBe(404);
    await database.pool.query(`UPDATE item_models SET status = 'active' WHERE id = $1`, [modelId]);
  });

  it('V-10 drawer inventory lists the models on offer with totals and free-now counts', async () => {
    const res = await call(undefined, 'GET', `/v1/drawers/${drawerId}/inventory`);
    expect(res.statusCode).toBe(200);
    const entries = res.json<
      Array<{
        itemModelId: string;
        total: number;
        availableNow: number;
        pricePerSlotPaise: number;
      }>
    >();
    const entry = entries.find((e) => e.itemModelId === modelId)!;
    expect(entry).toMatchObject({ total: 3, pricePerSlotPaise: 9900 }); // retired unit excluded, maintenance unit counted
    expect(entry.availableNow).toBeLessThanOrEqual(2);
    expect((await call(undefined, 'GET', '/v1/drawers/nope/inventory')).statusCode).toBe(404);
    // a drawer that is taken out of service is invisible to customers (this one has upcoming bookings, so use another)
    const retired = (await makeDrawer()).json<Drawer>();
    await call(boss, 'PATCH', `/v1/admin/drawers/${retired.id}`, { status: 'inactive' });
    expect((await call(undefined, 'GET', `/v1/drawers/${retired.id}/inventory`)).statusCode).toBe(
      404,
    );
  });
});

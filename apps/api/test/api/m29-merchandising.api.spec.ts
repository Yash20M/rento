import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createFactories, type Factories } from '../factories';
import { grantPermissions, makeSuperAdmin } from '../support/access';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeClock } from '../support/fake-clock';

const PASSWORD = 'correct horse battery staple';
const START = '2030-01-07T03:00:00Z'; // Monday 08:30 in Asia/Kolkata
const DAY = 24 * 3600_000;
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('banner-png'),
]);

interface Session {
  accessToken: string;
  user: { id: string };
  email: string;
  issuedAt: number;
}
interface Problem {
  code: string;
  errors?: Array<{ field: string; message: string }>;
}
interface Model {
  id: string;
  name: string;
  pricePerSlotPaise: number;
  discountPercent: number | null;
  discountStartsAt: string | null;
  discountEndsAt: string | null;
  featured: boolean;
  offerState: 'none' | 'scheduled' | 'active' | 'ended';
  isNew: boolean;
  createdAt: string;
}
interface Entry {
  itemModelId: string;
  pricePerSlotPaise: number;
  originalPricePerSlotPaise: number;
  discountPercent: number | null;
  discountEndsAt: string | null;
  isNew: boolean;
  featured: boolean;
  createdAt: string;
}
interface Booking {
  id: string;
  status: string;
  pricePaise: number;
  discountPaise: number;
  depositPaise: number;
  totalPaise: number;
  refund: { amountPaise: number } | null;
}
interface Promo {
  id: string;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  theme: string;
  imageUrl: string | null;
  itemModelId: string | null;
  itemModelName: string | null;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  sortOrder: number;
  state: 'live' | 'scheduled' | 'ended' | 'off';
}
interface PublicPromo {
  id: string;
  title: string;
  imageUrl: string | null;
  itemModelId: string | null;
  theme: string;
}

let database: TestDatabase;
let app: TestApp;
let clock: FakeClock;
let f: Factories;
let counter = 0;
let boss: Session;
let reader: Session;
let customer: Session;

beforeAll(async () => {
  database = await createTestDatabase();
  f = createFactories(database.db);
  clock = new FakeClock(START);
  app = await createTestApp({ config: testConfig({ DATABASE_URL: database.url }), clock });
  boss = await register();
  reader = await register();
  customer = await register();
  await makeSuperAdmin(database.pool, boss.user.id);
  await grantPermissions(database.pool, reader.user.id, ['inventory:read']);
});
afterAll(async () => {
  await app.app.close();
  await database.drop();
});
beforeEach(() => clock.set(START));

async function register(): Promise<Session> {
  const email = `m29-${(counter += 1)}-${Date.now()}@example.com`;
  const res = await app.app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email, password: PASSWORD, name: 'Tester' },
  });
  return { ...res.json<Session>(), email, issuedAt: clock.now().getTime() };
}
/** Tokens follow the fake clock, which these tests move by days: sign in again when it has moved. */
async function fresh(who: Session): Promise<Session> {
  const now = clock.now().getTime();
  if (Math.abs(now - who.issuedAt) <= 5 * 60_000) return who;
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
  payload?: unknown,
  headers: Record<string, string> = {},
) =>
  app.app.inject({
    method,
    url,
    headers: {
      ...(who && { authorization: `Bearer ${(await fresh(who)).accessToken}` }),
      ...headers,
    },
    ...(payload !== undefined && { payload: payload as never }),
  });
const upload = async (
  who: Session | undefined,
  method: 'POST' | 'DELETE',
  url: string,
  bytes?: Buffer,
  type = 'image/png',
) =>
  app.app.inject({
    method,
    url,
    headers: {
      ...(bytes && { 'content-type': type }),
      ...(who && { authorization: `Bearer ${(await fresh(who)).accessToken}` }),
    },
    ...(bytes && { payload: bytes }),
  });
const unique = (tag: string) => `${tag} ${(counter += 1)}-${Date.now()}`;
const iso = (ms: number) => new Date(clock.now().getTime() + ms).toISOString();

const modelBody = (categoryId: string, over: Record<string, unknown> = {}) => ({
  categoryId,
  name: unique('Model'),
  pricePerSlotPaise: 10_000,
  slotMinutes: 30,
  minDurationMin: 30,
  maxDurationMin: 240,
  bufferMin: 15,
  depositPaise: 20_000,
  ...over,
});
let categoryId: string;
const makeModel = async (over: Record<string, unknown> = {}): Promise<Model> => {
  categoryId ??= (await call(boss, 'POST', '/v1/admin/categories', { name: unique('Cat') })).json<{
    id: string;
  }>().id;
  const res = await call(boss, 'POST', '/v1/admin/item-models', modelBody(categoryId, over));
  expect(res.statusCode, res.body).toBe(201);
  return res.json<Model>();
};
const auditActions = async (entityId: string) =>
  (await database.pool.query('SELECT action FROM audit_logs WHERE entity_id = $1', [entityId])).rows
    .map((r) => r.action as string)
    .sort();

/** A drawer open 08:00–22:00 IST every day with `assets` units of [model]. */
async function stock(model: Model, assets = 1) {
  const drawer = await f.drawer();
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    await database.pool.query(
      `INSERT INTO drawer_hours (drawer_id, weekday, opens_at, closes_at) VALUES ($1, $2, '08:00', '22:00')`,
      [drawer.id, weekday],
    );
  }
  for (let i = 1; i <= assets; i += 1) {
    await f.asset({
      drawer_id: drawer.id,
      item_model_id: model.id,
      asset_code: `M29-${(counter += 1)}-${i}`,
    });
  }
  return drawer.id;
}
const inventoryOf = async (drawerId: string, modelId: string) =>
  (await call(undefined, 'GET', `/v1/drawers/${drawerId}/inventory`))
    .json<Entry[]>()
    .find((e) => e.itemModelId === modelId)!;

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
describe('offers on item models (admin)', () => {
  it('M-1 a model is created with an offer and a featured flag, and the view says what state the offer is in', async () => {
    const m = await makeModel({
      discountPercent: 20,
      discountStartsAt: iso(-DAY),
      discountEndsAt: iso(DAY),
      featured: true,
    });
    expect(m).toMatchObject({
      discountPercent: 20,
      featured: true,
      offerState: 'active',
      isNew: true,
      pricePerSlotPaise: 10_000, // the LIST price: what staff typed
    });
    expect(m.discountEndsAt).toBe(iso(DAY));
    expect(await auditActions(m.id)).toEqual(['item_model.created']);
    const snapshot = (
      await database.pool.query(`SELECT after FROM audit_logs WHERE entity_id = $1`, [m.id])
    ).rows[0].after;
    expect(snapshot).toMatchObject({ discountPercent: 20, featured: true });
  });

  it('M-2 without the new fields nothing changes: no offer, not featured', async () => {
    const m = await makeModel();
    expect(m).toMatchObject({
      discountPercent: null,
      discountStartsAt: null,
      discountEndsAt: null,
      featured: false,
      offerState: 'none',
    });
  });

  it.each([
    ['percent 0', { discountPercent: 0 }, 'discountPercent'],
    ['percent 91', { discountPercent: 91 }, 'discountPercent'],
    ['percent 12.5', { discountPercent: 12.5 }, 'discountPercent'],
    ['percent as text', { discountPercent: '20' }, 'discountPercent'],
    ['dates without a percent', { discountEndsAt: '2031-01-01T00:00:00Z' }, 'discountEndsAt'],
    [
      'end before start',
      {
        discountPercent: 10,
        discountStartsAt: '2031-02-01T00:00:00Z',
        discountEndsAt: '2031-01-01T00:00:00Z',
      },
      'discountEndsAt',
    ],
    [
      'end in the past',
      { discountPercent: 10, discountEndsAt: '2029-01-01T00:00:00Z' },
      'discountEndsAt',
    ],
    [
      'start that is not a date',
      { discountPercent: 10, discountStartsAt: 'next friday' },
      'discountStartsAt',
    ],
    [
      'date without a UTC offset',
      { discountPercent: 10, discountEndsAt: '2031-01-01T00:00:00' },
      'discountEndsAt',
    ],
    ['featured as text', { featured: 'yes' }, 'featured'],
  ])('M-3 refused with the field named: %s', async (_label, extra, field) => {
    categoryId ??= (
      await call(boss, 'POST', '/v1/admin/categories', { name: unique('Cat') })
    ).json<{ id: string }>().id;
    const res = await call(boss, 'POST', '/v1/admin/item-models', modelBody(categoryId, extra));
    expect(res.statusCode, res.body).toBe(422);
    expect(res.json<Problem>().errors?.map((e) => e.field)).toContain(field);
  });

  it('M-4 an offer can be set, changed and cleared on an existing model; nothing else is touched', async () => {
    const m = await makeModel({ name: 'Keep my name' });
    const set = await call(boss, 'PATCH', `/v1/admin/item-models/${m.id}`, {
      discountPercent: 15,
      discountEndsAt: iso(2 * DAY),
    });
    expect(set.statusCode, set.body).toBe(200);
    expect(set.json<Model>()).toMatchObject({
      name: 'Keep my name',
      discountPercent: 15,
      offerState: 'active',
    });

    const change = await call(boss, 'PATCH', `/v1/admin/item-models/${m.id}`, {
      discountPercent: 30,
    });
    expect(change.json<Model>()).toMatchObject({
      discountPercent: 30,
      discountEndsAt: iso(2 * DAY),
    });

    const feature = await call(boss, 'PATCH', `/v1/admin/item-models/${m.id}`, { featured: true });
    expect(feature.json<Model>()).toMatchObject({ featured: true, discountPercent: 30 });

    const clear = await call(boss, 'PATCH', `/v1/admin/item-models/${m.id}`, {
      discountPercent: null,
      discountStartsAt: null,
      discountEndsAt: null,
    });
    expect(clear.statusCode, clear.body).toBe(200);
    expect(clear.json<Model>()).toMatchObject({
      discountPercent: null,
      discountEndsAt: null,
      offerState: 'none',
      featured: true,
    });
    expect(await auditActions(m.id)).toEqual([
      'item_model.created',
      'item_model.updated',
      'item_model.updated',
      'item_model.updated',
      'item_model.updated',
    ]);
  });

  it('M-5 dates cannot be set on a model that has no offer; clearing the percent alone leaves dates behind and is refused', async () => {
    const plain = await makeModel();
    const bad = await call(boss, 'PATCH', `/v1/admin/item-models/${plain.id}`, {
      discountEndsAt: iso(DAY),
    });
    expect(bad.statusCode).toBe(422);
    expect(bad.json<Problem>().errors?.[0]?.field).toBe('discountEndsAt');

    const withOffer = await makeModel({ discountPercent: 10, discountEndsAt: iso(DAY) });
    const half = await call(boss, 'PATCH', `/v1/admin/item-models/${withOffer.id}`, {
      discountPercent: null,
    });
    expect(half.statusCode).toBe(422);
  });

  it('M-6 an offer that has run out keeps its old end date while other fields are edited (no false "in the past" error)', async () => {
    const m = await makeModel({ discountPercent: 10, discountEndsAt: iso(DAY) });
    clock.advance(3 * DAY);
    const res = await call(boss, 'PATCH', `/v1/admin/item-models/${m.id}`, {
      name: 'Renamed after the offer ended',
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json<Model>()).toMatchObject({ offerState: 'ended', discountPercent: 10 });
    // but a NEW end date in the past is refused
    const refused = await call(boss, 'PATCH', `/v1/admin/item-models/${m.id}`, {
      discountEndsAt: iso(-DAY),
    });
    expect(refused.statusCode).toBe(422);
  });

  it('M-7 the state follows the clock: scheduled → active → ended; "new" lasts 14 days', async () => {
    const m = await makeModel({
      discountPercent: 25,
      discountStartsAt: iso(DAY),
      discountEndsAt: iso(3 * DAY),
    });
    const state = async () =>
      (await call(boss, 'GET', `/v1/admin/item-models/${m.id}`)).json<Model>();
    expect((await state()).offerState).toBe('scheduled');
    clock.advance(2 * DAY);
    expect((await state()).offerState).toBe('active');
    clock.advance(2 * DAY);
    expect((await state()).offerState).toBe('ended');
    expect((await state()).isNew).toBe(true); // 4 days old
    clock.advance(11 * DAY);
    expect((await state()).isNew).toBe(false); // 15 days old
  });

  it('M-8 only people who may write the catalogue can change offers; readers can look', async () => {
    const m = await makeModel();
    expect(
      (await call(undefined, 'PATCH', `/v1/admin/item-models/${m.id}`, { featured: true }))
        .statusCode,
    ).toBe(401);
    expect(
      (await call(customer, 'PATCH', `/v1/admin/item-models/${m.id}`, { featured: true }))
        .statusCode,
    ).toBe(403);
    expect(
      (await call(reader, 'PATCH', `/v1/admin/item-models/${m.id}`, { featured: true })).statusCode,
    ).toBe(403);
    const seen = await call(reader, 'GET', `/v1/admin/item-models/${m.id}`);
    expect(seen.statusCode).toBe(200);
    expect(seen.json<Model>().featured).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
describe('what customers see', () => {
  it('M-9 while an offer is active the inventory shows the price to pay, the original, the percent and when it ends', async () => {
    const m = await makeModel({ discountPercent: 20, discountEndsAt: iso(DAY), featured: true });
    const drawer = await stock(m);
    expect(await inventoryOf(drawer, m.id)).toMatchObject({
      pricePerSlotPaise: 8_000,
      originalPricePerSlotPaise: 10_000,
      discountPercent: 20,
      discountEndsAt: iso(DAY),
      featured: true,
      isNew: true,
    });
  });

  it('M-10 no offer, a scheduled offer and an ended offer all show the normal price', async () => {
    const plain = await makeModel();
    const later = await makeModel({ discountPercent: 50, discountStartsAt: iso(DAY) });
    const ending = await makeModel({ discountPercent: 50, discountEndsAt: iso(DAY) });
    const d1 = await stock(plain);
    const d2 = await stock(later);
    const d3 = await stock(ending);
    for (const [d, m] of [
      [d1, plain],
      [d2, later],
      [d3, ending],
    ] as const) {
      expect(await inventoryOf(d, m.id), m.name).toMatchObject({
        pricePerSlotPaise: 10_000 - (m === ending ? 5_000 : 0),
      });
    }
    clock.advance(2 * DAY);
    expect(await inventoryOf(d3, ending.id)).toMatchObject({
      pricePerSlotPaise: 10_000,
      originalPricePerSlotPaise: 10_000,
      discountPercent: null,
      discountEndsAt: null,
    });
    expect(await inventoryOf(d2, later.id)).toMatchObject({
      pricePerSlotPaise: 5_000,
      discountPercent: 50,
    });
  });

  it('M-11 the availability answer (which the app totals the price from) carries the price to pay', async () => {
    const m = await makeModel({ discountPercent: 10 });
    const drawer = await stock(m);
    const res = await call(
      undefined,
      'GET',
      `/v1/drawers/${drawer}/items/${m.id}/availability?date=2030-01-08`,
    );
    expect(res.statusCode, res.body).toBe(200);
    expect(
      res.json<{
        pricePerSlotPaise: number;
        originalPricePerSlotPaise: number;
        discountPercent: number | null;
      }>(),
    ).toMatchObject({
      pricePerSlotPaise: 9_000,
      originalPricePerSlotPaise: 10_000,
      discountPercent: 10,
    });
  });

  it('M-12 a model older than 14 days is no longer "new"; an inactive model is not listed at all', async () => {
    const old = await makeModel();
    const drawer = await stock(old);
    await database.pool.query(`UPDATE item_models SET created_at = $2 WHERE id = $1`, [
      old.id,
      new Date(clock.now().getTime() - 20 * DAY),
    ]);
    expect((await inventoryOf(drawer, old.id)).isNew).toBe(false);
    await call(boss, 'PATCH', `/v1/admin/item-models/${old.id}`, { status: 'inactive' });
    const list = (await call(undefined, 'GET', `/v1/drawers/${drawer}/inventory`)).json<Entry[]>();
    expect(list.some((e) => e.itemModelId === old.id)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
describe('money: the price charged and what was saved', () => {
  const book = (
    w: { drawer: string; model: Model },
    minutes = 60,
    startsAt = '2030-01-07T04:30:00Z',
  ) =>
    call(
      customer,
      'POST',
      '/v1/bookings',
      { drawerId: w.drawer, itemModelId: w.model.id, startsAt, durationMinutes: minutes },
      { 'idempotency-key': `key-${(counter += 1)}-${Date.now()}` },
    );
  const pay = async (id: string) => {
    await call(customer, 'POST', `/v1/bookings/${id}/payment`);
    const checkout = await call(customer, 'POST', `/v1/bookings/${id}/payment/simulate`);
    const done = await call(
      customer,
      'POST',
      `/v1/bookings/${id}/payment/confirm`,
      checkout.json(),
    );
    expect(done.statusCode, done.body).toBe(200);
    return done.json<Booking>();
  };

  it('M-13 a booking during an offer is charged the offer price and records the saving; the deposit is never discounted', async () => {
    const model = await makeModel({ discountPercent: 20, depositPaise: 20_000 });
    const drawer = await stock(model);
    const res = await book({ drawer, model }, 60); // two 30-minute slots
    expect(res.statusCode, res.body).toBe(201);
    expect(res.json<Booking>()).toMatchObject({
      pricePaise: 16_000, // 2 × 8 000
      discountPaise: 4_000, // 2 × 2 000
      depositPaise: 20_000,
      totalPaise: 36_000,
    });
    const row = (
      await database.pool.query('SELECT price_paise, discount_paise FROM bookings WHERE id = $1', [
        res.json<Booking>().id,
      ])
    ).rows[0];
    expect(row).toEqual({ price_paise: 16_000, discount_paise: 4_000 });
  });

  it('M-14 a booking without an offer saves nothing', async () => {
    const model = await makeModel();
    const drawer = await stock(model);
    expect((await book({ drawer, model })).json<Booking>()).toMatchObject({
      pricePaise: 20_000,
      discountPaise: 0,
    });
  });

  it('M-15 the price is fixed when the booking is made: ending or changing the offer afterwards does not touch it', async () => {
    const model = await makeModel({ discountPercent: 50 });
    const drawer = await stock(model);
    const made = (await book({ drawer, model })).json<Booking>();
    expect(made.pricePaise).toBe(10_000);
    await call(boss, 'PATCH', `/v1/admin/item-models/${model.id}`, {
      discountPercent: null,
      pricePerSlotPaise: 99_000,
    });
    const again = (await call(customer, 'GET', `/v1/bookings/${made.id}`)).json<Booking>();
    expect(again).toMatchObject({ pricePaise: 10_000, discountPaise: 10_000 });
  });

  it('M-16 the refund is worked out from what was charged, not from the list price', async () => {
    const model = await makeModel({ discountPercent: 20, depositPaise: 20_000 });
    const drawer = await stock(model);
    const farStart = '2030-01-20T04:30:00Z'; // more than 24 h ahead: full refund
    const held = (await book({ drawer, model }, 60, farStart)).json<Booking>();
    await pay(held.id);
    const cancelled = await call(customer, 'POST', `/v1/bookings/${held.id}/cancel`);
    expect(cancelled.statusCode, cancelled.body).toBe(200);
    // 100 % of the 16 000 paid for the rental + the whole deposit; NOT 20 000 + deposit
    expect(cancelled.json<Booking>().refund?.amountPaise).toBe(16_000 + 20_000);
  });

  const T10 = '2030-01-07T04:30:00Z';
  const running = async (model: Model, drawer: string) => {
    const held = (await book({ drawer, model }, 60, T10)).json<Booking>();
    await pay(held.id);
    clock.set(T10);
    const handed = await call(boss, 'POST', `/v1/admin/bookings/${held.id}/pickup`);
    expect(handed.statusCode, handed.body).toBe(200);
    return held.id;
  };
  const extendAndPay = async (id: string, minutes: number) => {
    const started = await call(customer, 'POST', `/v1/bookings/${id}/extend`, {
      extraMinutes: minutes,
    });
    expect(started.statusCode, started.body).toBe(201);
    const ext = started.json<{ id: string; pricePaise: number }>();
    const checkout = await call(
      customer,
      'POST',
      `/v1/bookings/${id}/extensions/${ext.id}/simulate`,
    );
    const done = await call(
      customer,
      'POST',
      `/v1/bookings/${id}/extensions/${ext.id}/confirm`,
      checkout.json(),
    );
    expect(done.statusCode, done.body).toBe(200);
    return { ext, booking: done.json<Booking>() };
  };

  it('M-18 extending a running rental during the offer costs the offer price and adds to what was saved', async () => {
    const model = await makeModel({ discountPercent: 20 });
    const drawer = await stock(model);
    const id = await running(model, drawer);
    const { ext, booking } = await extendAndPay(id, 30);
    expect(ext.pricePaise).toBe(8_000);
    expect(booking).toMatchObject({ pricePaise: 16_000 + 8_000, discountPaise: 4_000 + 2_000 });
  });

  it('M-19 an extension bought after the offer ended costs the normal price and saves nothing more', async () => {
    const model = await makeModel({ discountPercent: 20, discountEndsAt: '2030-01-07T05:00:00Z' });
    const drawer = await stock(model);
    const id = await running(model, drawer);
    clock.set('2030-01-07T05:10:00Z'); // the offer ran out during the rental
    const { ext, booking } = await extendAndPay(id, 30);
    expect(ext.pricePaise).toBe(10_000);
    expect(booking).toMatchObject({ pricePaise: 16_000 + 10_000, discountPaise: 4_000 });
  });

  it('M-17 an odd price rounds the discount down: the customer never gets more than the stated percent', async () => {
    const model = await makeModel({ pricePerSlotPaise: 9_999, discountPercent: 20 });
    const drawer = await stock(model);
    const b = (await book({ drawer, model }, 30)).json<Booking>();
    expect(b.discountPaise).toBe(1_999); // floor(1999.8)
    expect(b.pricePaise).toBe(9_999 - 1_999);
    expect(b.pricePaise + b.discountPaise).toBe(9_999);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
describe('banners (promotions) — admin', () => {
  const create = (body: Record<string, unknown>, who: Session | null = boss) =>
    call(who ?? undefined, 'POST', '/v1/admin/promotions', body);

  it('P-1 needs sign-in and the catalogue-write permission', async () => {
    expect((await create({ title: 'x' }, null)).statusCode).toBe(401);
    expect((await create({ title: 'x' }, customer)).statusCode).toBe(403);
    expect((await create({ title: 'x' }, reader)).statusCode).toBe(403);
    expect((await call(reader, 'GET', '/v1/admin/promotions')).statusCode).toBe(200);
    expect((await call(customer, 'GET', '/v1/admin/promotions')).statusCode).toBe(403);
    expect((await call(undefined, 'GET', '/v1/admin/promotions')).statusCode).toBe(401);
  });

  it('P-2 a banner needs only a title; everything else has a sensible default; the create is audited', async () => {
    const res = await create({ title: 'Weekend offer' });
    expect(res.statusCode, res.body).toBe(201);
    const p = res.json<Promo>();
    expect(p).toMatchObject({
      title: 'Weekend offer',
      subtitle: null,
      ctaLabel: null,
      theme: 'orange',
      imageUrl: null,
      itemModelId: null,
      itemModelName: null,
      startsAt: null,
      endsAt: null,
      active: true,
      sortOrder: 0,
      state: 'live',
    });
    expect(await auditActions(p.id)).toEqual(['promotion.created']);
  });

  it.each([
    ['no title', {}, 'title'],
    ['empty title', { title: '' }, 'title'],
    ['title too long', { title: 'x'.repeat(81) }, 'title'],
    ['subtitle too long', { title: 't', subtitle: 'y'.repeat(161) }, 'subtitle'],
    ['button label too long', { title: 't', ctaLabel: 'z'.repeat(31) }, 'ctaLabel'],
    ['unknown theme', { title: 't', theme: 'neon' }, 'theme'],
    ['order below 0', { title: 't', sortOrder: -1 }, 'sortOrder'],
    ['order above 10000', { title: 't', sortOrder: 10_001 }, 'sortOrder'],
    ['order not whole', { title: 't', sortOrder: 1.5 }, 'sortOrder'],
    ['active as text', { title: 't', active: 'yes' }, 'active'],
    ['product that is not a uuid', { title: 't', itemModelId: 'abc' }, 'itemModelId'],
    [
      'product that does not exist',
      { title: 't', itemModelId: '00000000-0000-4000-8000-000000000000' },
      'itemModelId',
    ],
    [
      'end before start',
      { title: 't', startsAt: '2031-02-01T00:00:00Z', endsAt: '2031-01-01T00:00:00Z' },
      'endsAt',
    ],
    ['date that is not a date', { title: 't', startsAt: 'soon' }, 'startsAt'],
    ['unknown field', { title: 't', colour: 'red' }, 'colour'],
  ])('P-3 refused with the field named: %s', async (_label, body, field) => {
    const res = await create(body);
    expect(res.statusCode, res.body).toBe(422);
    expect(res.json<Problem>().errors?.map((e) => e.field)).toContain(field);
  });

  it('P-4 a banner can open a product; the product name comes with it', async () => {
    const m = await makeModel({ name: 'Camera for banner' });
    const p = (await create({ title: 'Look', itemModelId: m.id })).json<Promo>();
    expect(p).toMatchObject({ itemModelId: m.id, itemModelName: 'Camera for banner' });
  });

  it('P-5 the state says what customers see: live, scheduled, ended or off', async () => {
    const live = (
      await create({ title: 'a', startsAt: iso(-DAY), endsAt: iso(DAY) })
    ).json<Promo>();
    const soon = (await create({ title: 'b', startsAt: iso(DAY) })).json<Promo>();
    const over = (await create({ title: 'c', endsAt: iso(DAY) })).json<Promo>();
    const off = (await create({ title: 'd', active: false })).json<Promo>();
    expect([live.state, soon.state, over.state, off.state]).toEqual([
      'live',
      'scheduled',
      'live',
      'off',
    ]);
    clock.advance(2 * DAY);
    const list = (await call(boss, 'GET', '/v1/admin/promotions')).json<Promo[]>();
    const by = (id: string) => list.find((p) => p.id === id)!.state;
    expect([by(live.id), by(soon.id), by(over.id), by(off.id)]).toEqual([
      'ended',
      'live',
      'ended',
      'off',
    ]);
  });

  it('P-6 changing a banner changes only what was sent; nulls clear optional fields; every change is audited', async () => {
    const p = (
      await create({
        title: 'Original',
        subtitle: 'Sub',
        ctaLabel: 'Go',
        theme: 'ink',
        sortOrder: 5,
      })
    ).json<Promo>();
    const edit = await call(boss, 'PATCH', `/v1/admin/promotions/${p.id}`, {
      title: 'Edited',
      subtitle: null,
      active: false,
    });
    expect(edit.statusCode, edit.body).toBe(200);
    expect(edit.json<Promo>()).toMatchObject({
      title: 'Edited',
      subtitle: null,
      ctaLabel: 'Go',
      theme: 'ink',
      sortOrder: 5,
      active: false,
      state: 'off',
    });
    expect(await auditActions(p.id)).toEqual(['promotion.created', 'promotion.updated']);
    expect(
      (await call(boss, 'PATCH', `/v1/admin/promotions/${p.id}`, { title: '' })).statusCode,
    ).toBe(422);
    expect(
      (
        await call(boss, 'PATCH', '/v1/admin/promotions/00000000-0000-4000-8000-000000000000', {
          title: 'x',
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await call(boss, 'PATCH', '/v1/admin/promotions/not-a-uuid', { title: 'x' })).statusCode,
    ).toBe(404);
  });

  it('P-7 deleting removes the banner and its picture; deleting twice is a 404', async () => {
    const p = (await create({ title: 'Doomed' })).json<Promo>();
    const withPicture = await upload(boss, 'POST', `/v1/admin/promotions/${p.id}/image`, PNG);
    expect(withPicture.statusCode, withPicture.body).toBe(200);
    const mediaId = withPicture.json<Promo>().imageUrl!.split('/').pop()!;
    expect((await call(boss, 'DELETE', `/v1/admin/promotions/${p.id}`)).statusCode).toBe(204);
    expect((await call(boss, 'DELETE', `/v1/admin/promotions/${p.id}`)).statusCode).toBe(404);
    expect(
      (await database.pool.query('SELECT 1 FROM media WHERE id = $1', [mediaId])).rowCount,
    ).toBe(0);
    expect(await auditActions(p.id)).toEqual([
      'promotion.created',
      'promotion.deleted',
      'promotion.image_set',
    ]);
  });

  it('P-8 the picture: stored after a real signature check, replaced (old one deleted), removable; bad files are refused', async () => {
    const p = (await create({ title: 'Pictured' })).json<Promo>();
    const url = `/v1/admin/promotions/${p.id}/image`;
    expect((await upload(undefined, 'POST', url, PNG)).statusCode).toBe(401);
    expect((await upload(customer, 'POST', url, PNG)).statusCode).toBe(403);
    expect(
      (await upload(boss, 'POST', url, Buffer.from('not an image'), 'image/png')).statusCode,
    ).toBe(422);
    expect((await upload(boss, 'POST', url, PNG, 'image/jpeg')).statusCode).toBe(422); // type does not match the bytes
    expect(
      (await upload(boss, 'POST', url, PNG, 'application/pdf')).statusCode,
    ).toBeGreaterThanOrEqual(400);
    expect(
      (await upload(boss, 'POST', url, Buffer.alloc(5 * 1024 * 1024 + 10, 1), 'image/png'))
        .statusCode,
    ).toBeGreaterThanOrEqual(400);

    const first = (await upload(boss, 'POST', url, PNG)).json<Promo>();
    expect(first.imageUrl).toMatch(/^\/v1\/media\/[0-9a-f-]{36}$/);
    const served = await app.app.inject({ method: 'GET', url: first.imageUrl! });
    expect(served.statusCode).toBe(200);
    expect(served.headers['content-type']).toBe('image/png');

    const second = (await upload(boss, 'POST', url, PNG)).json<Promo>();
    expect(second.imageUrl).not.toBe(first.imageUrl);
    expect((await app.app.inject({ method: 'GET', url: first.imageUrl! })).statusCode).toBe(404);

    const cleared = await upload(boss, 'DELETE', url);
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json<Promo>().imageUrl).toBeNull();
    expect(
      (
        await upload(
          boss,
          'POST',
          '/v1/admin/promotions/00000000-0000-4000-8000-000000000000/image',
          PNG,
        )
      ).statusCode,
    ).toBe(404);
  });

  it('P-9 the admin list shows every banner, in the order customers will see them', async () => {
    await create({ title: 'zz-order-2', sortOrder: 2 });
    await create({ title: 'zz-order-1', sortOrder: 1 });
    const list = (await call(boss, 'GET', '/v1/admin/promotions'))
      .json<Promo[]>()
      .filter((p) => p.title.startsWith('zz-order'));
    expect(list.map((p) => p.title)).toEqual(['zz-order-1', 'zz-order-2']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
describe('banners — what customers see', () => {
  const create = async (body: Record<string, unknown>) =>
    (await call(boss, 'POST', '/v1/admin/promotions', body)).json<Promo>();
  const publicList = async (): Promise<PublicPromo[]> => {
    const res = await call(undefined, 'GET', '/v1/promotions');
    expect(res.statusCode, res.body).toBe(200);
    return res.json<PublicPromo[]>();
  };
  const titles = async () => (await publicList()).map((p) => p.title);

  it("P-10 needs no sign-in and shows only live banners: active, begun and not ended, in the admin's order", async () => {
    await database.pool.query('DELETE FROM promotions');
    await create({ title: 'second', sortOrder: 2 });
    await create({ title: 'first', sortOrder: 1 });
    await create({ title: 'switched off', active: false });
    await create({ title: 'not yet', startsAt: iso(DAY) });
    await create({ title: 'already over', endsAt: iso(-1000), startsAt: iso(-DAY) });
    await create({ title: 'ends later', endsAt: iso(DAY), sortOrder: 3 });
    expect(await titles()).toEqual(['first', 'second', 'ends later']);
    clock.advance(2 * DAY);
    expect(await titles()).toEqual(['not yet', 'first', 'second']); // 'not yet' has the default order 0
  });

  it('P-11 equal order keeps the oldest first; the public view has no admin-only fields', async () => {
    await database.pool.query('DELETE FROM promotions');
    await create({ title: 'old' });
    await create({ title: 'newer' });
    const list = await publicList();
    expect(list.map((p) => p.title)).toEqual(['old', 'newer']);
    expect(Object.keys(list[0]!).sort()).toEqual(
      ['ctaLabel', 'id', 'imageUrl', 'itemModelId', 'subtitle', 'theme', 'title'].sort(),
    );
  });

  it('P-12 a banner whose product was taken off the shelf still shows, but no longer opens it', async () => {
    await database.pool.query('DELETE FROM promotions');
    const m = await makeModel();
    await create({ title: 'Opens product', itemModelId: m.id });
    expect((await publicList())[0]?.itemModelId).toBe(m.id);
    await call(boss, 'PATCH', `/v1/admin/item-models/${m.id}`, { status: 'inactive' });
    expect((await publicList())[0]?.itemModelId).toBeNull();
  });

  it('P-13 a picture appears as a public address that serves the image', async () => {
    await database.pool.query('DELETE FROM promotions');
    const p = await create({ title: 'With picture' });
    await upload(boss, 'POST', `/v1/admin/promotions/${p.id}/image`, PNG);
    const [shown] = await publicList();
    expect(shown?.imageUrl).toMatch(/^\/v1\/media\//);
    expect((await app.app.inject({ method: 'GET', url: shown!.imageUrl! })).statusCode).toBe(200);
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

const START = '2030-01-07T03:00:00Z'; // Monday 08:30 in Asia/Kolkata
const T10 = '2030-01-09T04:30:00Z'; // two days later, 10:00 IST
const DAY = 86_400_000;

type Session = TestSession;
interface Problem {
  code: string;
}
interface Booking {
  id: string;
}
interface Dashboard {
  windowDays: number;
  now: { held: number; confirmed: number; active: number; overdue: number };
  lastDays: {
    completed: number;
    cancelled: number;
    noShow: number;
    expired: number;
    grossPaise: number;
    refundedPaise: number;
  };
  upcoming: Array<{ id: string; status: string; customer: { email: string | null } }>;
}
interface AuditEntry {
  id: string;
  at: string;
  action: string;
  entityType: string;
  entityId: string | null;
  reason: string | null;
  actor: { id: string; email: string | null } | null;
  before: unknown;
  after: unknown;
}
interface AuditPage {
  items: AuditEntry[];
  nextCursor: string | null;
}

let database: TestDatabase;
let app: TestApp;
let clock: FakeClock;
let f: Factories;
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

const register = (): Promise<Session> => registerSession(app, clock, 'm4');
const call = async (
  who: Session | undefined,
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
async function world(assets = 3): Promise<World> {
  const drawer = await f.drawer();
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
    buffer_min: 15,
    deposit_paise: 20000,
  });
  for (let i = 1; i <= assets; i += 1) {
    await f.asset({
      drawer_id: drawer.id,
      item_model_id: model.id,
      asset_code: `M4-${(counter += 1)}-${i}`,
    });
  }
  return { drawerId: drawer.id, modelId: model.id };
}
const hold = async (who: Session, w: World): Promise<Booking> => {
  const res = await call(
    who,
    'POST',
    '/v1/bookings',
    { drawerId: w.drawerId, itemModelId: w.modelId, startsAt: T10, durationMinutes: 60 },
    { 'idempotency-key': `k-${(counter += 1)}-${Date.now()}` },
  );
  expect(res.statusCode, res.body).toBe(201);
  return res.json<Booking>();
};
const pay = async (who: Session, id: string): Promise<void> => {
  await call(who, 'POST', `/v1/bookings/${id}/payment`);
  const checkout = (await call(who, 'POST', `/v1/bookings/${id}/payment/simulate`)).json();
  const res = await call(who, 'POST', `/v1/bookings/${id}/payment/confirm`, checkout);
  expect(res.statusCode, res.body).toBe(200);
};

describe('dashboard', () => {
  it('D-1 needs bookings:read: no token 401, customers 403', async () => {
    expect((await call(undefined, 'GET', '/v1/admin/dashboard')).statusCode).toBe(401);
    expect((await call(alice, 'GET', '/v1/admin/dashboard')).statusCode).toBe(403);
    const other = await register();
    await grantPermissions(database.pool, other.user.id, ['inventory:read']);
    expect((await call(other, 'GET', '/v1/admin/dashboard')).statusCode).toBe(403);
  });

  it('D-2 counts what is going on, the last days and the money — limited to the administrator’s drawer', async () => {
    const mine = await world();
    const elsewhere = await world();
    const staff = await register();
    await grantPermissions(database.pool, staff.user.id, ['bookings:read'], mine.drawerId);

    const confirmed = await hold(alice, mine);
    await pay(alice, confirmed.id);
    await hold(bob, mine); // stays a hold
    const cancelled = await hold(carol, mine);
    await pay(carol, cancelled.id);
    clock.advance(1000);
    expect((await call(carol, 'POST', `/v1/bookings/${cancelled.id}/cancel`)).statusCode).toBe(200);
    // somebody else's drawer: must not show up
    const theirs = await hold(alice, elsewhere);
    await pay(alice, theirs.id);

    const dash = (await call(staff, 'GET', '/v1/admin/dashboard')).json<Dashboard>();
    expect(dash.windowDays).toBe(7);
    expect(dash.now).toEqual({ held: 1, confirmed: 1, active: 0, overdue: 0 });
    expect(dash.lastDays).toMatchObject({ cancelled: 1, completed: 0, noShow: 0, expired: 0 });
    expect(dash.lastDays.grossPaise).toBe(2 * 29800); // alice and carol paid rental + deposit
    expect(dash.lastDays.refundedPaise).toBe(29800); // carol cancelled two days ahead: everything back
    expect(dash.upcoming.map((u) => u.id)).toEqual([confirmed.id]);
    expect(dash.upcoming[0]?.customer.email).toBe(alice.email);

    const everything = (await call(boss, 'GET', '/v1/admin/dashboard')).json<Dashboard>();
    expect(everything.now.confirmed).toBeGreaterThanOrEqual(2);
  });

  it('D-3 an administrator with no drawer in scope sees zeros, and the window moves with the clock', async () => {
    const w = await world();
    const staff = await register();
    await grantPermissions(database.pool, staff.user.id, ['bookings:read'], w.drawerId);
    const b = await hold(alice, w);
    await pay(alice, b.id);
    clock.advance(1000);
    await call(alice, 'POST', `/v1/bookings/${b.id}/cancel`);

    const fresh = (await call(staff, 'GET', '/v1/admin/dashboard')).json<Dashboard>();
    expect(fresh.lastDays.cancelled).toBe(1);
    expect(fresh.lastDays.grossPaise).toBe(29800);

    const stranger = await register();
    await grantPermissions(
      database.pool,
      stranger.user.id,
      ['bookings:read'],
      (await world()).drawerId,
    );
    const empty = (await call(stranger, 'GET', '/v1/admin/dashboard')).json<Dashboard>();
    expect(empty.now).toEqual({ held: 0, confirmed: 0, active: 0, overdue: 0 });
    expect(empty.lastDays.grossPaise).toBe(0);
    expect(empty.upcoming).toEqual([]);

    clock.advance(8 * DAY); // the cancellation is now older than the window
    const later = (await call(staff, 'GET', '/v1/admin/dashboard')).json<Dashboard>();
    expect(later.lastDays).toEqual({
      completed: 0,
      cancelled: 0,
      noShow: 0,
      expired: 0,
      grossPaise: 0,
      refundedPaise: 0,
    });
    clock.set(START);
  });
});

describe('audit log viewer', () => {
  it('A-1 needs an unrestricted audit:read: no token 401, customers 403, drawer-limited grants refused', async () => {
    expect((await call(undefined, 'GET', '/v1/admin/audit-logs')).statusCode).toBe(401);
    expect((await call(alice, 'GET', '/v1/admin/audit-logs')).statusCode).toBe(403);
    const reader = await register();
    await grantPermissions(database.pool, reader.user.id, ['audit:read']);
    expect((await call(reader, 'GET', '/v1/admin/audit-logs')).statusCode).toBe(200);
    const scoped = await register();
    await grantPermissions(database.pool, scoped.user.id, ['audit:read'], (await world()).drawerId);
    const refused = await call(scoped, 'GET', '/v1/admin/audit-logs');
    expect(refused.statusCode).toBe(403);
    expect(refused.json<Problem>().code).toBe('PERMISSION_DENIED');
  });

  it('A-2 lists newest first with who, what and why; filters by entity, action, actor and time', async () => {
    const w = await world();
    const b = await hold(alice, w);
    await pay(alice, b.id);
    clock.advance(5000);
    const cancelled = await call(boss, 'POST', `/v1/admin/bookings/${b.id}/cancel`, {
      reason: 'Unit damaged',
    });
    expect(cancelled.statusCode, cancelled.body).toBe(200);

    const page = (
      await call(boss, 'GET', `/v1/admin/audit-logs?entityType=booking&entityId=${b.id}`)
    ).json<AuditPage>();
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      action: 'booking.cancelled',
      entityType: 'booking',
      entityId: b.id,
      reason: 'Unit damaged',
      actor: { id: boss.user.id, email: boss.email },
      before: { status: 'confirmed' },
    });

    const prefix = (
      await call(boss, 'GET', '/v1/admin/audit-logs?action=booking.&limit=100')
    ).json<AuditPage>();
    expect(prefix.items.every((i) => i.action.startsWith('booking.'))).toBe(true);
    expect(prefix.items.map((i) => i.id)).toContain(page.items[0]!.id);
    const exact = (
      await call(boss, 'GET', '/v1/admin/audit-logs?action=booking.cancelled&limit=100')
    ).json<AuditPage>();
    expect(exact.items.every((i) => i.action === 'booking.cancelled')).toBe(true);
    const byActor = (
      await call(boss, 'GET', `/v1/admin/audit-logs?actorId=${boss.user.id}&limit=100`)
    ).json<AuditPage>();
    expect(byActor.items.every((i) => i.actor?.id === boss.user.id)).toBe(true);
    expect(byActor.items.length).toBeGreaterThanOrEqual(1);

    const at = new Date(page.items[0]!.at).getTime();
    const before = (
      await call(
        boss,
        'GET',
        `/v1/admin/audit-logs?entityId=${b.id}&to=${new Date(at).toISOString()}`,
      )
    ).json<AuditPage>();
    expect(before.items).toEqual([]); // `to` is exclusive
    const during = (
      await call(
        boss,
        'GET',
        `/v1/admin/audit-logs?entityId=${b.id}&from=${new Date(at).toISOString()}`,
      )
    ).json<AuditPage>();
    expect(during.items).toHaveLength(1);
  });

  it('A-3 pages without gaps or repeats, newest first', async () => {
    const creator = boss;
    const names: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      clock.advance(1000);
      const name = `Audit role ${(counter += 1)}-${Date.now()}`;
      names.push(name);
      expect(
        (await call(creator, 'POST', '/v1/admin/roles', { name, permissions: [] })).statusCode,
      ).toBe(201);
    }
    const seen: AuditEntry[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const url: string = `/v1/admin/audit-logs?entityType=role&action=role.created&limit=4${cursor ? `&cursor=${cursor}` : ''}`;
      const res = (await call(boss, 'GET', url)).json<AuditPage>();
      seen.push(...res.items);
      cursor = res.nextCursor;
      pages += 1;
    } while (cursor && pages < 10);
    expect(new Set(seen.map((s) => s.id)).size).toBe(seen.length); // no repeats
    const ours = seen.filter((s) => names.includes((s.after as { name?: string }).name ?? ''));
    expect(ours).toHaveLength(6); // no gaps
    const times = seen.map((s) => new Date(s.at).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times); // newest first
    expect(pages).toBeGreaterThanOrEqual(2);
  });

  it('A-4 bad filters are refused', async () => {
    for (const q of [
      'action=Bad Action',
      'action=booking.cancelled.extra',
      'entityType=Booking',
      'actorId=not-a-uuid',
      'from=yesterday',
      'limit=0',
      'limit=101',
      'cursor=garbage',
      'unknown=1',
    ]) {
      const res = await call(boss, 'GET', `/v1/admin/audit-logs?${encodeURI(q)}`);
      expect(res.statusCode, q).toBe(422);
    }
  });

  it('A-5 what the trail stores has no secrets: no password or token appears in any entry', async () => {
    const w = await world();
    const b = await hold(alice, w);
    await pay(alice, b.id);
    await call(boss, 'POST', `/v1/admin/bookings/${b.id}/cancel`, { reason: 'check secrets' });
    const all = (await call(boss, 'GET', '/v1/admin/audit-logs?limit=100')).body;
    expect(all).not.toContain(TEST_PASSWORD);
    expect(all.toLowerCase()).not.toMatch(
      /"(password|token|refreshtoken|accesstoken|signature)"\s*:\s*"(?!\[redacted)/,
    );
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createFactories, type Factories } from '../factories';
import { grantPermissions, makeSuperAdmin } from '../support/access';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeClock } from '../support/fake-clock';
import { type TestSession, freshSession, registerSession } from '../support/sessions';
import { aadhaarFrom } from '../unit/aadhaar.unit.spec';

const START = '2030-01-07T03:00:00Z';
const OTP = '123456';
const MIN = 60_000;
const DAY = 86_400_000;

interface Problem {
  code: string;
  errors?: Array<{ field: string; message: string }>;
}
interface Kyc {
  required: boolean;
  status: string;
  maskedAadhaar: string | null;
  verifiedName: string | null;
  reason: string | null;
}
interface Started {
  requestId: string;
  maskedAadhaar: string;
}
interface Customer {
  id: string;
  email: string | null;
  kycStatus: string;
  maskedAadhaar: string | null;
  bookingCount: number;
}
interface Page {
  items: Customer[];
  nextCursor: string | null;
}

let database: TestDatabase;
let app: TestApp;
let clock: FakeClock;
let f: Factories;
let counter = 0;
let boss: TestSession;
// Each Aadhaar number must be unique per test: build them from a counter.
const nextAadhaar = () => aadhaarFrom(`2${String((counter += 1)).padStart(10, '0')}`);

beforeAll(async () => {
  database = await createTestDatabase();
  f = createFactories(database.db);
  clock = new FakeClock(START);
  app = await createTestApp({
    config: testConfig({ DATABASE_URL: database.url, KYC_REQUIRED: 'true', KYC_FAKE_OTP: OTP }),
    clock,
  });
  boss = await registerSession(app, clock, 'k');
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
const customer = () => registerSession(app, clock, 'k');
const start = (who: TestSession, aadhaarNumber: string) =>
  call(who, 'POST', '/v1/me/kyc/aadhaar', { aadhaarNumber });
const verify = (who: TestSession, requestId: string, otp = OTP) =>
  call(who, 'POST', '/v1/me/kyc/aadhaar/verify', { requestId, otp });
async function verified(who: TestSession, number = nextAadhaar()): Promise<void> {
  const s = (await start(who, number)).json<Started>();
  expect((await verify(who, s.requestId)).statusCode).toBe(200);
}

interface World {
  drawerId: string;
  modelId: string;
}
async function world(): Promise<World> {
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
  });
  await f.asset({
    drawer_id: drawer.id,
    item_model_id: model.id,
    asset_code: `KY-${(counter += 1)}`,
  });
  return { drawerId: drawer.id, modelId: model.id };
}
const book = (who: TestSession, w: World) =>
  call(
    who,
    'POST',
    '/v1/bookings',
    {
      drawerId: w.drawerId,
      itemModelId: w.modelId,
      startsAt: '2030-01-09T04:30:00.000Z',
      durationMinutes: 60,
    },
    { 'idempotency-key': `ky-${(counter += 1)}-${Date.now()}` },
  );
const one = async (sql: string, args: unknown[] = []) =>
  (await database.pool.query(sql, args)).rows[0];

describe('the booking gate', () => {
  it('K-1 an unverified customer cannot book: 403 KYC_REQUIRED, nothing is held or stored', async () => {
    clock.set(START);
    const w = await world();
    const who = await customer();
    expect((await call(who, 'GET', '/v1/me/kyc')).json<Kyc>()).toMatchObject({
      required: true,
      status: 'none',
    });
    const res = await book(who, w);
    expect(res.statusCode).toBe(403);
    expect(res.json<Problem>().code).toBe('KYC_REQUIRED');
    expect(
      await one('SELECT count(*)::int AS n FROM bookings WHERE user_id = $1', [who.user.id]),
    ).toEqual({ n: 0 });
    expect(
      await one(
        'SELECT count(*)::int AS n FROM asset_occupancies WHERE asset_id IN (SELECT id FROM assets WHERE drawer_id = $1)',
        [w.drawerId],
      ),
    ).toEqual({ n: 0 });
    expect((await book(undefined as never, w)).statusCode).toBe(401);
  });

  it('K-2 after verification the same customer books normally', async () => {
    clock.set(START);
    const w = await world();
    const who = await customer();
    await verified(who);
    expect((await book(who, w)).statusCode).toBe(201);
  });

  it('K-3 a declined (rejected) customer stays blocked until staff reset it', async () => {
    clock.set(START);
    const w = await world();
    const who = await customer();
    await call(boss, 'POST', `/v1/admin/customers/${who.user.id}/kyc`, {
      decision: 'reject',
      reason: 'Name does not match',
    });
    expect((await book(who, w)).json<Problem>().code).toBe('KYC_REQUIRED');
    expect((await start(who, nextAadhaar())).statusCode).toBe(409); // cannot self-serve around a decline
    expect((await call(who, 'GET', '/v1/me/kyc')).json<Kyc>()).toMatchObject({
      status: 'rejected',
      reason: 'Name does not match',
    });
  });
});

describe('verifying with Aadhaar', () => {
  it('K-4 start → wrong code (counted) → right code: verified, masked, and the number is stored nowhere', async () => {
    clock.set(START);
    const who = await customer();
    const number = nextAadhaar();
    const spaced = `${number.slice(0, 4)} ${number.slice(4, 8)} ${number.slice(8)}`;
    const s = await start(who, spaced);
    expect(s.statusCode, s.body).toBe(200);
    const started = s.json<Started>();
    expect(started.maskedAadhaar).toBe(`XXXX XXXX ${number.slice(-4)}`);
    expect((await call(who, 'GET', '/v1/me/kyc')).json<Kyc>().status).toBe('pending');

    const wrong = await verify(who, started.requestId, '000000');
    expect(wrong.statusCode).toBe(422);
    expect(wrong.json<Problem>().errors?.[0]).toMatchObject({ field: 'otp' });
    expect(wrong.json<Problem>().errors?.[0]?.message).toContain('4 attempts left');

    const done = await verify(who, started.requestId);
    expect(done.statusCode, done.body).toBe(200);
    expect(done.json<Kyc>()).toMatchObject({
      status: 'verified',
      maskedAadhaar: `XXXX XXXX ${number.slice(-4)}`,
      verifiedName: 'Aadhaar Holder (demo)',
    });

    // PRIVACY: neither table, nor any API answer, nor the log contains the full number.
    const dump = JSON.stringify([
      (await database.pool.query('SELECT * FROM user_kyc')).rows,
      (await database.pool.query('SELECT * FROM kyc_requests')).rows,
      (await database.pool.query('SELECT * FROM audit_logs')).rows,
    ]);
    expect(dump).not.toContain(number);
    expect(s.body + done.body).not.toContain(number);
    expect(app.logLines.join('\n')).not.toContain(number);
    const row = await one('SELECT aadhaar_last4, aadhaar_hash FROM user_kyc WHERE user_id = $1', [
      who.user.id,
    ]);
    expect(row.aadhaar_last4).toBe(number.slice(-4));
    expect(row.aadhaar_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await one(`SELECT action FROM audit_logs WHERE entity_id = $1`, [who.user.id])).toEqual({
      action: 'kyc.verified',
    });
  });

  it('K-5 a number that is not a valid Aadhaar is refused before anything is sent or stored', async () => {
    const who = await customer();
    const good = nextAadhaar();
    const typo = good.slice(0, 11) + String((Number(good[11]) + 1) % 10);
    for (const bad of [
      '',
      '12345',
      '23456789012',
      'abcdefghijkl',
      aadhaarFrom('12345678901'),
      typo,
      `${good}0`,
    ]) {
      const res = await start(who, bad);
      expect(res.statusCode, bad).toBe(422);
      expect(res.json<Problem>().code).toBe('VALIDATION_FAILED');
    }
    expect(
      await one('SELECT count(*)::int AS n FROM kyc_requests WHERE user_id = $1', [who.user.id]),
    ).toEqual({ n: 0 });
  });

  it('K-6 the same card cannot verify two accounts (refused at start, and again if both started first)', async () => {
    clock.set(START);
    const number = nextAadhaar();
    const first = await customer();
    const second = await customer();
    const third = await customer();
    const s2 = (await start(second, number)).json<Started>(); // both start before anybody finishes
    await verified(first, number);

    const late = await verify(second, s2.requestId);
    expect(late.statusCode).toBe(409);
    expect(late.json<Problem>().code).toBe('AADHAAR_IN_USE');
    const blocked = await start(third, number);
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json<Problem>().code).toBe('AADHAAR_IN_USE');
    expect((await call(second, 'GET', '/v1/me/kyc')).json<Kyc>().status).not.toBe('verified');
  });

  it("K-7 five wrong codes lock the request; an old code expires; someone else's request is invisible", async () => {
    clock.set(START);
    const who = await customer();
    const other = await customer();
    const s = (await start(who, nextAadhaar())).json<Started>();
    expect((await verify(other, s.requestId)).statusCode).toBe(404);
    for (let i = 0; i < 5; i += 1)
      expect((await verify(who, s.requestId, '000000')).statusCode).toBe(422);
    const locked = await verify(who, s.requestId); // even the right code now
    expect(locked.statusCode).toBe(429);

    clock.set(START);
    const fresh = (await start(who, nextAadhaar())).json<Started>();
    clock.advance(11 * MIN);
    const late = await verify(who, fresh.requestId);
    expect(late.statusCode).toBe(422);
    expect(late.json<Problem>().errors?.[0]?.message).toContain('expired');
    clock.set(START);
  });

  it('K-8 at most five starts per day; verified customers cannot start again', async () => {
    clock.set(START);
    const who = await customer();
    for (let i = 0; i < 5; i += 1) expect((await start(who, nextAadhaar())).statusCode).toBe(200);
    const sixth = await start(who, nextAadhaar());
    expect(sixth.statusCode).toBe(429);
    expect(sixth.json<Problem>().code).toBe('RATE_LIMITED');
    clock.advance(DAY + MIN);
    const again = await start(who, nextAadhaar());
    expect(again.statusCode, again.body).toBe(200);
    expect((await verify(who, again.json<Started>().requestId)).statusCode).toBe(200);
    const twice = await start(who, nextAadhaar());
    expect(twice.statusCode).toBe(409);
    expect(twice.json<Problem>().code).toBe('INVALID_STATE');
    clock.set(START);
  });

  it('K-9 everything needs a signed-in customer', async () => {
    expect((await call(undefined, 'GET', '/v1/me/kyc')).statusCode).toBe(401);
    expect(
      (await call(undefined, 'POST', '/v1/me/kyc/aadhaar', { aadhaarNumber: nextAadhaar() }))
        .statusCode,
    ).toBe(401);
    expect(
      (
        await call(undefined, 'POST', '/v1/me/kyc/aadhaar/verify', {
          requestId: '00000000-0000-4000-8000-000000000000',
          otp: OTP,
        })
      ).statusCode,
    ).toBe(401);
    const who = await customer();
    expect((await verify(who, 'not-a-uuid')).statusCode).toBe(422);
    expect(
      (
        await call(who, 'POST', '/v1/me/kyc/aadhaar/verify', {
          requestId: '00000000-0000-4000-8000-000000000000',
          otp: 'abc',
        })
      ).statusCode,
    ).toBe(422);
  });
});

describe('staff: customers and decisions', () => {
  it('C-1 permissions: no token 401, customers 403, readers cannot decide, drawer-limited grants refused', async () => {
    clock.set(START);
    const target = await customer();
    expect((await call(undefined, 'GET', '/v1/admin/customers')).statusCode).toBe(401);
    expect((await call(target, 'GET', '/v1/admin/customers')).statusCode).toBe(403);
    const reader = await customer();
    await grantPermissions(database.pool, reader.user.id, ['users:read']);
    expect((await call(reader, 'GET', '/v1/admin/customers')).statusCode).toBe(200);
    expect((await call(reader, 'GET', `/v1/admin/customers/${target.user.id}`)).statusCode).toBe(
      200,
    );
    expect(
      (
        await call(reader, 'POST', `/v1/admin/customers/${target.user.id}/kyc`, {
          decision: 'approve',
          reason: 'checked',
        })
      ).statusCode,
    ).toBe(403);
    const scoped = await customer();
    await grantPermissions(database.pool, scoped.user.id, ['users:read'], (await world()).drawerId);
    expect((await call(scoped, 'GET', '/v1/admin/customers')).statusCode).toBe(403);
  });

  it('C-2 the list shows state and bookings, filters by state and text, and pages without gaps', async () => {
    clock.set(START);
    const a = await customer();
    const b = await customer();
    await verified(a);
    await start(b, nextAadhaar()); // pending
    const all = (await call(boss, 'GET', '/v1/admin/customers?limit=100')).json<Page>();
    const byId = new Map(all.items.map((c) => [c.id, c]));
    expect(byId.get(a.user.id)).toMatchObject({
      kycStatus: 'verified',
      maskedAadhaar: expect.stringMatching(/^XXXX XXXX \d{4}$/),
    });
    expect(byId.get(b.user.id)).toMatchObject({ kycStatus: 'pending' });
    const verifiedOnly = (
      await call(boss, 'GET', '/v1/admin/customers?kyc=verified&limit=100')
    ).json<Page>();
    expect(verifiedOnly.items.every((c) => c.kycStatus === 'verified')).toBe(true);
    expect(verifiedOnly.items.map((c) => c.id)).toContain(a.user.id);
    const search = (
      await call(boss, 'GET', `/v1/admin/customers?q=${encodeURIComponent(a.email)}`)
    ).json<Page>();
    expect(search.items.map((c) => c.id)).toEqual([a.user.id]);

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const url: string = `/v1/admin/customers?limit=3${cursor ? `&cursor=${cursor}` : ''}`;
      const page = (await call(boss, 'GET', url)).json<Page>();
      seen.push(...page.items.map((c) => c.id));
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor && pages < 50);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toHaveLength(all.items.length);
    for (const q of ['kyc=maybe', 'limit=0', 'cursor=garbage']) {
      expect((await call(boss, 'GET', `/v1/admin/customers?${q}`)).statusCode, q).toBe(422);
    }
  });

  it('C-3 manual approval unblocks booking; reject blocks it; reset makes the customer verify again; each is audited with the reason', async () => {
    clock.set(START);
    const w = await world();
    const who = await customer();
    const decide = (decision: string, reason = 'Checked the original card at the counter') =>
      call(boss, 'POST', `/v1/admin/customers/${who.user.id}/kyc`, { decision, reason });

    expect((await decide('approve')).json<Kyc>().status).toBe('verified');
    expect((await book(who, w)).statusCode).toBe(201);
    expect((await decide('reject', 'Card looks altered')).json<Kyc>()).toMatchObject({
      status: 'rejected',
      reason: 'Card looks altered',
    });
    expect((await book(who, await world())).json<Problem>().code).toBe('KYC_REQUIRED');
    expect((await decide('reset', 'Customer brought a new card')).json<Kyc>().status).toBe('none');
    await verified(who); // can verify again

    const detail = (await call(boss, 'GET', `/v1/admin/customers/${who.user.id}`)).json<
      Customer & { kyc: Kyc; activeBookings: number }
    >();
    expect(detail).toMatchObject({ kycStatus: 'verified', bookingCount: 1, activeBookings: 1 });
    const audit = await database.pool.query(
      `SELECT action, reason, actor_id FROM audit_logs WHERE entity_id = $1 ORDER BY at, action`,
      [who.user.id],
    );
    const actions = audit.rows.map((r) => r.action as string).sort();
    expect(actions).toEqual(['kyc.approved', 'kyc.rejected', 'kyc.reset', 'kyc.verified']);
    expect(audit.rows.find((r) => r.action === 'kyc.rejected')).toMatchObject({
      reason: 'Card looks altered',
      actor_id: boss.user.id,
    });
  });

  it('C-4 a decision needs a reason and a real customer; unknown ids are 404', async () => {
    const who = await customer();
    const url = `/v1/admin/customers/${who.user.id}/kyc`;
    expect((await call(boss, 'POST', url, { decision: 'approve' })).statusCode).toBe(422);
    expect((await call(boss, 'POST', url, { decision: 'approve', reason: 'x' })).statusCode).toBe(
      422,
    );
    expect(
      (await call(boss, 'POST', url, { decision: 'delete', reason: 'because' })).statusCode,
    ).toBe(422);
    expect(
      (
        await call(boss, 'POST', '/v1/admin/customers/00000000-0000-4000-8000-000000000000/kyc', {
          decision: 'approve',
          reason: 'because',
        })
      ).statusCode,
    ).toBe(404);
    expect((await call(boss, 'GET', '/v1/admin/customers/not-a-uuid')).statusCode).toBe(404);
    expect(
      (await call(boss, 'GET', '/v1/admin/customers/00000000-0000-4000-8000-000000000000'))
        .statusCode,
    ).toBe(404);
    expect((await call(who, 'GET', '/v1/me/kyc')).json<Kyc>().status).toBe('none');
  });
});

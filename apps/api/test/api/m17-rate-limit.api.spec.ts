import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SlidingWindow } from '../../src/common/rate-limit/sliding-window';
import { createFactories, type Factories } from '../factories';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeClock } from '../support/fake-clock';
import { TEST_PASSWORD, registerSession } from '../support/sessions';

const START = '2030-01-07T03:00:00Z';
const MIN = 60_000;

describe('sliding window', () => {
  it('RL-1 allows up to the limit, then refuses until the oldest event ages out', () => {
    const w = new SlidingWindow();
    for (let i = 0; i < 3; i += 1) expect(w.hit('k', 3, 60_000, i * 1000).allowed).toBe(true);
    const refused = w.hit('k', 3, 60_000, 5000);
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterMs).toBe(55_000);
    expect(w.hit('k', 3, 60_000, 60_001).allowed).toBe(true); // the first event (t=0) is out
  });

  it('RL-2 keys are independent and refused events do not extend the window', () => {
    const w = new SlidingWindow();
    expect(w.hit('a', 1, 1000, 0).allowed).toBe(true);
    for (let t = 100; t < 900; t += 100) expect(w.hit('a', 1, 1000, t).allowed).toBe(false);
    expect(w.hit('b', 1, 1000, 500).allowed).toBe(true);
    expect(w.hit('a', 1, 1000, 1001).allowed).toBe(true);
  });
});

let database: TestDatabase;
let app: TestApp;
let clock: FakeClock;
let f: Factories;

beforeAll(async () => {
  database = await createTestDatabase();
  f = createFactories(database.db);
  clock = new FakeClock(START);
  app = await createTestApp({
    config: testConfig({
      DATABASE_URL: database.url,
      RATE_LIMIT_ENABLED: 'true',
      AUTH_RATE_PER_IP: '12',
      AUTH_RATE_PER_ACCOUNT: '6',
      BOOKING_RATE_PER_USER: '4',
      LOGIN_MAX_FAILURES: '3',
      LOGIN_LOCK_MINUTES: '10',
    }),
    clock,
  });
});
afterAll(async () => {
  await app.app.close();
  await database.drop();
});

const login = (email: string, password: string, ip = '10.0.0.1') =>
  app.app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    remoteAddress: ip,
    payload: { email, password },
  });

describe('sign-in lockout', () => {
  it('RL-3 three wrong passwords lock that address for the account, even for the right password; the answer says when to retry', async () => {
    const s = await registerSession(app, clock, 'lock');
    clock.advance(11 * MIN); // the registration itself counted against the per-minute window
    for (let i = 0; i < 3; i += 1) {
      expect((await login(s.email, 'wrong password!!', '10.0.0.2')).statusCode).toBe(401);
    }
    const locked = await login(s.email, TEST_PASSWORD, '10.0.0.2');
    expect(locked.statusCode).toBe(429);
    expect(locked.headers['retry-after']).toBe('600');
    expect(locked.json<{ code: string }>().code).toBe('RATE_LIMITED');
  });

  it('RL-4 the lock is per address: the real owner from another address still signs in', async () => {
    const s = await registerSession(app, clock, 'pair');
    clock.advance(11 * MIN);
    for (let i = 0; i < 3; i += 1) await login(s.email, 'nope nope nope', '10.0.0.3');
    expect((await login(s.email, TEST_PASSWORD, '10.0.0.3')).statusCode).toBe(429);
    expect((await login(s.email, TEST_PASSWORD, '10.0.0.4')).statusCode).toBe(200);
  });

  it('RL-5 the lock ends by itself; a repeat offender is locked twice as long, and a success forgives', async () => {
    const s = await registerSession(app, clock, 'again');
    clock.advance(11 * MIN);
    const ip = '10.0.0.5';
    for (let i = 0; i < 3; i += 1) await login(s.email, 'nope nope nope', ip);
    expect((await login(s.email, TEST_PASSWORD, ip)).headers['retry-after']).toBe('600');
    clock.advance(10 * MIN + 1000); // the first lock is over
    for (let i = 0; i < 3; i += 1) await login(s.email, 'nope nope nope', ip); // and straight back to guessing
    const second = await login(s.email, TEST_PASSWORD, ip);
    expect(second.statusCode).toBe(429);
    expect(second.headers['retry-after']).toBe('1200'); // twice as long

    clock.advance(20 * MIN + 1000);
    expect((await login(s.email, TEST_PASSWORD, ip)).statusCode).toBe(200); // lock over: the owner is back in
  });

  it('RL-6 an unknown account is throttled the same way and answers like a wrong password', async () => {
    const first = await login('nobody@example.com', 'whatever password', '10.0.0.6');
    expect(first.statusCode).toBe(401);
    await login('nobody@example.com', 'whatever password', '10.0.0.6');
    await login('nobody@example.com', 'whatever password', '10.0.0.6');
    expect((await login('nobody@example.com', 'whatever password', '10.0.0.6')).statusCode).toBe(
      429,
    );
  });

  it('RL-7 failures spread over many addresses lock the account itself (a higher bar)', async () => {
    const s = await registerSession(app, clock, 'spread');
    clock.advance(11 * MIN);
    // 15 failures from 15 different addresses: none reaches its own limit of 3, together they reach the account's (5 × 3).
    for (let i = 0; i < 15; i += 1) {
      await login(s.email, 'nope nope nope', `10.1.0.${i + 1}`);
    }
    const res = await login(s.email, TEST_PASSWORD, '10.1.9.9');
    expect(res.statusCode).toBe(429);
  });
});

describe('request limits', () => {
  it('RL-8 sign-in endpoints are limited per address; the limit lifts as the minute passes', async () => {
    const ip = '10.2.0.1';
    const results: number[] = [];
    for (let i = 0; i < 13; i += 1) {
      results.push((await login(`who${i}@example.com`, 'wrong password!!', ip)).statusCode);
    }
    expect(results.slice(0, 12).every((s) => s === 401)).toBe(true);
    const over = await login('who99@example.com', 'wrong password!!', ip);
    expect(over.statusCode).toBe(429);
    expect(Number(over.headers['retry-after'])).toBeGreaterThan(0);
    expect(over.headers['content-type']).toContain('application/problem+json');
    clock.advance(61_000);
    expect((await login('who100@example.com', 'wrong password!!', ip)).statusCode).toBe(401);
  });

  it('RL-9 one account name is limited across addresses (recovery spam, credential stuffing)', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      const res = await app.app.inject({
        method: 'POST',
        url: '/v1/auth/password/forgot',
        remoteAddress: `10.3.0.${i + 1}`,
        payload: { email: 'victim@example.com' },
      });
      statuses.push(res.statusCode);
    }
    expect(statuses.slice(0, 6).every((s) => s === 202)).toBe(true);
    expect(statuses.slice(6).every((s) => s === 429)).toBe(true);
  });

  it('RL-10 booking attempts are limited per customer, not per address', async () => {
    const drawer = await f.drawer();
    for (let weekday = 1; weekday <= 7; weekday += 1) {
      await database.pool.query(
        `INSERT INTO drawer_hours (drawer_id, weekday, opens_at, closes_at) VALUES ($1, $2, '00:00', '23:59')`,
        [drawer.id, weekday],
      );
    }
    const model = await f.itemModel({ slot_minutes: 30, min_duration_min: 30 });
    await f.asset({
      drawer_id: drawer.id,
      item_model_id: model.id,
      asset_code: `RL-${Date.now()}`,
    });
    const spammer = await registerSession(app, clock, 'spam');
    const other = await registerSession(app, clock, 'calm');
    clock.advance(2 * MIN);
    const book = (token: string, key: string, ip: string) =>
      app.app.inject({
        method: 'POST',
        url: '/v1/bookings',
        remoteAddress: ip,
        headers: { authorization: `Bearer ${token}`, 'idempotency-key': key },
        payload: {
          drawerId: drawer.id,
          itemModelId: model.id,
          startsAt: '2030-01-09T05:00:00Z',
          durationMinutes: 30,
        },
      });
    const codes: number[] = [];
    for (let i = 0; i < 6; i += 1)
      codes.push((await book(spammer.accessToken, `spam-key-${i}-x`, '10.4.0.1')).statusCode);
    expect(codes.slice(0, 4).every((c) => c !== 429)).toBe(true);
    expect(codes.slice(4)).toEqual([429, 429]);
    // Another customer behind the SAME address is not punished for it.
    expect((await book(other.accessToken, 'calm-key-1-x', '10.4.0.1')).statusCode).not.toBe(429);
  });

  it('RL-11 routes without a limit policy (health, catalogue) are never throttled', async () => {
    for (let i = 0; i < 40; i += 1) {
      const res = await app.app.inject({
        method: 'GET',
        url: '/healthz',
        remoteAddress: '10.5.0.1',
      });
      expect(res.statusCode).toBe(200);
    }
  });

  it('RL-12 the browser-session login is covered by the same lockout', async () => {
    const s = await registerSession(app, clock, 'web');
    clock.advance(11 * MIN);
    const web = (password: string) =>
      app.app.inject({
        method: 'POST',
        url: '/v1/auth/session/login',
        remoteAddress: '10.6.0.1',
        headers: { 'x-requested-with': 'rento-web' },
        payload: { email: s.email, password },
      });
    for (let i = 0; i < 3; i += 1) expect((await web('nope nope nope')).statusCode).toBe(401);
    expect((await web(TEST_PASSWORD)).statusCode).toBe(429);
  });
});

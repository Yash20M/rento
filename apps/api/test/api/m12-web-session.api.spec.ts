import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeSuperAdmin } from '../support/access';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeClock } from '../support/fake-clock';
import { TEST_PASSWORD, registerSession, type TestSession } from '../support/sessions';

const ALLOWED = 'http://localhost:5173';
const CSRF = { 'x-requested-with': 'rento-web' };

let database: TestDatabase;
let app: TestApp;
let clock: FakeClock;
let admin: TestSession;

beforeAll(async () => {
  database = await createTestDatabase();
  clock = new FakeClock('2030-01-07T03:00:00Z');
  app = await createTestApp({
    config: testConfig({ DATABASE_URL: database.url, CORS_ALLOWED_ORIGINS: ALLOWED }),
    clock,
  });
  admin = await registerSession(app, clock, 'web');
  await makeSuperAdmin(database.pool, admin.user.id);
});
afterAll(async () => {
  await app.app.close();
  await database.drop();
});

const setCookie = (res: { headers: Record<string, unknown> }): string => {
  const raw = res.headers['set-cookie'];
  return Array.isArray(raw) ? String(raw[0]) : String(raw ?? '');
};
const cookiePair = (header: string): string => header.split(';')[0]!;
const login = (
  email = admin.email,
  password = TEST_PASSWORD,
  headers: Record<string, string> = CSRF,
) =>
  app.app.inject({
    method: 'POST',
    url: '/v1/auth/session/login',
    headers,
    payload: { email, password },
  });
const refresh = (cookie: string | undefined, headers: Record<string, string> = CSRF) =>
  app.app.inject({
    method: 'POST',
    url: '/v1/auth/session/refresh',
    headers: { ...headers, ...(cookie && { cookie }) },
  });

describe('browser sessions (HttpOnly refresh cookie)', () => {
  it('W-1 login returns only the access token; the refresh token is an HttpOnly, SameSite=Strict cookie scoped to the session path', async () => {
    const res = await login();
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json<Record<string, unknown>>();
    expect(body['accessToken']).toBeTruthy();
    expect(body).not.toHaveProperty('refreshToken');
    expect(res.body).not.toContain(cookiePair(setCookie(res)).split('=')[1]!.slice(0, 20));
    const cookie = setCookie(res);
    expect(cookie).toMatch(/^rento_rt=[^;]{20,}/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/v1/auth/session');
    expect(cookie).toMatch(/Max-Age=\d+/);
    expect(cookie).not.toContain('Secure'); // plain http in development and tests
    expect(res.headers['cache-control']).toBe('no-store');

    const me = await app.app.inject({
      method: 'GET',
      url: '/v1/admin/me',
      headers: { authorization: `Bearer ${String(body['accessToken'])}` },
    });
    expect(me.statusCode).toBe(200);
  });

  it('W-2 a wrong password is the same generic refusal and sets no cookie', async () => {
    const res = await login(admin.email, 'wrong password entirely');
    expect(res.statusCode).toBe(401);
    expect(setCookie(res)).toBe('');
  });

  it('W-3 refresh with the cookie rotates it: a new access token and a new cookie; the old cookie is dead', async () => {
    const first = cookiePair(setCookie(await login()));
    const res = await refresh(first);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json<{ accessToken: string }>().accessToken).toBeTruthy();
    const next = cookiePair(setCookie(res));
    expect(next).not.toBe(first);

    const reuse = await refresh(first); // a stolen, already-spent cookie
    expect(reuse.statusCode).toBe(401);
    expect(setCookie(reuse)).toContain('Max-Age=0'); // told to forget it
    // Reuse of a spent token revokes the whole session: even the newest cookie stops working.
    expect((await refresh(next)).statusCode).toBe(401);
  });

  it('W-4 CSRF: no custom header ⇒ 403; a foreign origin ⇒ 403; an allowed or same origin works; no cookie ⇒ 401', async () => {
    const cookie = cookiePair(setCookie(await login()));
    expect((await refresh(cookie, {})).statusCode).toBe(403);
    expect((await refresh(cookie, { 'x-requested-with': 'something-else' })).statusCode).toBe(403);
    expect((await refresh(cookie, { ...CSRF, origin: 'https://evil.example' })).statusCode).toBe(
      403,
    );
    expect((await refresh(undefined)).statusCode).toBe(401);
    const ok = await refresh(cookie, { ...CSRF, origin: ALLOWED });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(ok.headers['access-control-allow-credentials']).toBe('true');
    // The refused attempts did not burn the session.
    const after = await refresh(cookiePair(setCookie(ok)));
    expect(after.statusCode).toBe(200);
  });

  it('W-5 logout revokes the session server-side and clears the cookie; repeating it is harmless', async () => {
    const cookie = cookiePair(setCookie(await login()));
    const res = await app.app.inject({
      method: 'POST',
      url: '/v1/auth/session/logout',
      headers: { ...CSRF, cookie },
    });
    expect(res.statusCode).toBe(204);
    expect(setCookie(res)).toContain('Max-Age=0');
    expect((await refresh(cookie)).statusCode).toBe(401); // the old cookie is useless now
    const again = await app.app.inject({
      method: 'POST',
      url: '/v1/auth/session/logout',
      headers: CSRF,
    });
    expect(again.statusCode).toBe(204);
    const noHeader = await app.app.inject({
      method: 'POST',
      url: '/v1/auth/session/logout',
      headers: { cookie },
    });
    expect(noHeader.statusCode).toBe(403);
  });

  it('W-6 cross-origin cookies are allowed on the session routes only', async () => {
    const preflight = await app.app.inject({
      method: 'OPTIONS',
      url: '/v1/auth/session/refresh',
      headers: {
        origin: ALLOWED,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'x-requested-with',
      },
    });
    expect(preflight.headers['access-control-allow-credentials']).toBe('true');
    expect(preflight.headers['access-control-allow-headers']).toContain('x-requested-with');
    const elsewhere = await app.app.inject({
      method: 'GET',
      url: '/healthz',
      headers: { origin: ALLOWED },
    });
    expect(elsewhere.headers['access-control-allow-credentials']).toBeUndefined();
    const stranger = await app.app.inject({
      method: 'OPTIONS',
      url: '/v1/auth/session/refresh',
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' },
    });
    expect(stranger.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('W-7 in production the cookie is Secure', async () => {
    const prod = await createTestApp({
      config: testConfig({ DATABASE_URL: database.url, NODE_ENV: 'production' }),
      clock,
    });
    try {
      const res = await prod.app.inject({
        method: 'POST',
        url: '/v1/auth/session/login',
        headers: CSRF,
        payload: { email: admin.email, password: TEST_PASSWORD },
      });
      expect(res.statusCode, res.body).toBe(200);
      expect(setCookie(res)).toContain('Secure');
    } finally {
      await prod.app.close();
    }
  });

  it('W-8 a session started by cookie shows up as an ordinary refresh family: password reset signs it out', async () => {
    const cookie = cookiePair(setCookie(await login()));
    await database.pool.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1`, [
      admin.user.id,
    ]);
    expect((await refresh(cookie)).statusCode).toBe(401);
  });
});

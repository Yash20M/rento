import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/app-config';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';

const ALLOWED = 'http://localhost:5555';

let app: TestApp;
let closed: TestApp;
beforeAll(async () => {
  app = await createTestApp({
    config: testConfig({ CORS_ALLOWED_ORIGINS: `${ALLOWED},https://admin.rento.example` }),
  });
  closed = await createTestApp({ config: testConfig() });
});
afterAll(async () => {
  await app.app.close();
  await closed.app.close();
});

describe('CORS', () => {
  it('C-1 a preflight from an allowed origin is answered 204 with exactly the headers the client needs', async () => {
    const res = await app.app.inject({
      method: 'OPTIONS',
      url: '/v1/bookings',
      headers: {
        origin: ALLOWED,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,content-type,idempotency-key',
      },
    });
    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(res.headers['access-control-allow-methods']).toContain('POST');
    expect(res.headers['access-control-allow-headers']).toContain('idempotency-key');
    expect(res.headers['access-control-allow-headers']).toContain('authorization');
    expect(res.headers['access-control-max-age']).toBe('600');
    expect(res.headers['vary']).toContain('Origin');
    expect(res.headers['access-control-allow-credentials']).toBeUndefined(); // cookies are never allowed
  });

  it('C-2 a real request from an allowed origin carries the allow-origin header and exposes the replay marker', async () => {
    const res = await app.app.inject({
      method: 'GET',
      url: '/healthz',
      headers: { origin: ALLOWED },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(res.headers['access-control-expose-headers']).toContain('idempotency-replayed');
  });

  it('C-3 errors are readable cross-origin too (the browser must be able to show a problem+json)', async () => {
    const res = await app.app.inject({
      method: 'GET',
      url: '/v1/bookings',
      headers: { origin: ALLOWED },
    });
    expect(res.statusCode).toBe(401);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
  });

  it('C-4 any other origin gets no CORS headers (matching is exact: not a prefix, not another port, not http for https)', async () => {
    for (const origin of [
      'http://evil.example',
      'http://localhost:5556',
      'http://localhost:5555.evil.example',
      'https://localhost:5555',
      'http://localhost',
      'null',
    ]) {
      const res = await app.app.inject({
        method: 'OPTIONS',
        url: '/v1/bookings',
        headers: { origin, 'access-control-request-method': 'POST' },
      });
      expect(res.headers['access-control-allow-origin'], origin).toBeUndefined();
      expect(res.statusCode, origin).not.toBe(204);
    }
  });

  it('C-5 requests without an Origin (the mobile app, curl, the same-origin admin) are untouched', async () => {
    const res = await app.app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('C-6 with no allow-list configured (the default) nothing is allowed, not even a preflight', async () => {
    const res = await closed.app.inject({
      method: 'OPTIONS',
      url: '/v1/bookings',
      headers: { origin: ALLOWED, 'access-control-request-method': 'POST' },
    });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.statusCode).not.toBe(204);
  });

  it('C-7 the allow-list in the environment must be origins: a path, a trailing slash or a wildcard is refused', () => {
    const env = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://u:p@h/d',
      JWT_SECRET: 'x'.repeat(32),
    };
    expect(
      loadConfig({ ...env, CORS_ALLOWED_ORIGINS: ' http://localhost:5555 , https://a.example ' })
        .corsAllowedOrigins,
    ).toEqual(['http://localhost:5555', 'https://a.example']);
    expect(loadConfig(env).corsAllowedOrigins).toEqual([]);
    for (const bad of [
      '*',
      'http://localhost:5555/',
      'http://localhost:5555/path',
      'localhost:5555',
      'ftp://a.example',
    ]) {
      expect(() => loadConfig({ ...env, CORS_ALLOWED_ORIGINS: bad }), bad).toThrow(
        /CORS_ALLOWED_ORIGINS/,
      );
    }
  });
});

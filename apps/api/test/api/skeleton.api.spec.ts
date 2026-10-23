import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type TestApp,
  UNREACHABLE_DATABASE_URL,
  createTestApp,
  testConfig,
} from '../support/create-test-app';

let current: TestApp | undefined;

async function start(options?: Parameters<typeof createTestApp>[0]): Promise<TestApp> {
  current = await createTestApp(options);
  return current;
}

afterEach(async () => {
  await current?.app.close();
  current = undefined;
});

const upPing = { ping: async () => undefined };

describe('health', () => {
  it('A-01 GET /healthz → 200 {status:ok}', async () => {
    const { app } = await start({ databasePing: upPing });
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('A-02a GET /readyz → 200 when the database answers', async () => {
    const { app } = await start({ databasePing: upPing });
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ready', checks: { database: 'up' } });
  });

  it('A-02b GET /readyz → 503 problem+json against a really unreachable database', async () => {
    const { app } = await start({ config: testConfig({ DATABASE_URL: UNREACHABLE_DATABASE_URL }) });
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(503);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const body = res.json<Record<string, unknown>>();
    expect(body).toMatchObject({
      status: 503,
      code: 'RETRY_LATER',
      detail: 'Database unavailable',
    });
    expect(JSON.stringify(body)).not.toMatch(/ECONNREFUSED|127\.0\.0\.1|rento:rento/);
  });

  it('A-03 GET /readyz → 503 once draining, even if the database is up', async () => {
    const { app, shutdownState } = await start({ databasePing: upPing });
    shutdownState.beginDraining();
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ code: 'RETRY_LATER' });
  });
});

describe('error handling', () => {
  it.each(['/nope', '/v1/nope'])('A-04 unknown route %s → 404 problem+json', async (url) => {
    const { app } = await start({ databasePing: upPing });
    const res = await app.inject({ method: 'GET', url });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const body = res.json<{ code: string; traceId: string; type: string }>();
    expect(body.code).toBe('NOT_FOUND');
    expect(body.type).toBe('urn:rento:problem:not-found');
    expect(body.traceId).toBe(res.headers['x-request-id']);
  });

  it('A-05 malformed JSON → 400 VALIDATION_FAILED', async () => {
    const { app } = await start({ databasePing: upPing });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/__test/echo',
      headers: { 'content-type': 'application/json' },
      payload: '{',
    });
    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
    expect(res.json<{ detail: string }>().detail).toMatch(/JSON/);
  });

  it('A-06 unknown field → 422 naming the field', async () => {
    const { app } = await start({ databasePing: upPing });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/__test/echo',
      payload: { name: 'drill', quantity: 1, isAdmin: true },
    });
    expect(res.statusCode).toBe(422);
    const { errors } = res.json<{ errors: Array<{ field: string; message: string }> }>();
    expect(errors.map((e) => e.field)).toContain('isAdmin');
  });

  it('A-07 reports all invalid fields in one response', async () => {
    const { app } = await start({ databasePing: upPing });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/__test/echo',
      payload: { name: '', quantity: 0 },
    });
    expect(res.statusCode).toBe(422);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const body = res.json<{ code: string; errors: Array<{ field: string }> }>();
    expect(body.code).toBe('VALIDATION_FAILED');
    const fields = body.errors.map((e) => e.field);
    expect(fields).toContain('name');
    expect(fields).toContain('quantity');
  });

  it('A-07b a valid body passes through', async () => {
    const { app } = await start({ databasePing: upPing });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/__test/echo',
      payload: { name: 'drill', quantity: 2 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ name: 'drill', quantity: 2 });
  });

  it('A-09 unhandled exception → generic 500, real error only in the log', async () => {
    const { app, logs } = await start({ databasePing: upPing });
    const res = await app.inject({ method: 'GET', url: '/v1/__test/boom' });
    expect(res.statusCode).toBe(500);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({ status: 500, code: 'INTERNAL_ERROR' });
    expect(res.body).not.toContain('hunter2');

    const errorLog = logs().find((l) => l['msg'] === 'unhandled exception');
    expect(errorLog).toBeDefined();
    expect(errorLog?.['level']).toBe(50);
    expect(errorLog?.['reqId']).toBe(res.headers['x-request-id']);
  });
});

describe('request id', () => {
  it('A-08 replaces a malformed inbound id and echoes a valid one', async () => {
    const { app } = await start({ databasePing: upPing });

    const bad = await app.inject({
      method: 'GET',
      url: '/healthz',
      headers: { 'x-request-id': 'abc' },
    });
    expect(bad.headers['x-request-id']).not.toBe('abc');
    expect(bad.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);

    const good = await app.inject({
      method: 'GET',
      url: '/healthz',
      headers: { 'x-request-id': 'client-req-0001' },
    });
    expect(good.headers['x-request-id']).toBe('client-req-0001');
  });
});

describe('routing & docs', () => {
  it('A-10 /v1 prefix applies to business routes; health stays outside it', async () => {
    const { app } = await start({ databasePing: upPing });
    const prefixed = await app.inject({
      method: 'POST',
      url: '/v1/__test/echo',
      payload: { name: 'a', quantity: 1 },
    });
    const bare = await app.inject({
      method: 'POST',
      url: '/__test/echo',
      payload: { name: 'a', quantity: 1 },
    });
    const health = await app.inject({ method: 'GET', url: '/v1/healthz' });
    expect(prefixed.statusCode).toBe(201);
    expect(bare.statusCode).toBe(404);
    expect(health.statusCode).toBe(404);
  });

  it('A-11 serves OpenAPI 3 documenting /healthz and /readyz outside production', async () => {
    const { app } = await start({ databasePing: upPing });
    const res = await app.inject({ method: 'GET', url: '/docs-json' });
    expect(res.statusCode).toBe(200);
    const doc = res.json<{
      openapi: string;
      info: { title: string };
      paths: Record<string, unknown>;
    }>();
    expect(doc.openapi).toMatch(/^3\./);
    expect(doc.info.title).toBe('Rento API');
    expect(Object.keys(doc.paths)).toEqual(expect.arrayContaining(['/healthz', '/readyz']));

    const ui = await app.inject({ method: 'GET', url: '/docs' });
    expect(ui.statusCode).toBe(200);
  });

  it('A-12 hides docs in production with problem+json 404', async () => {
    const { app } = await start({
      config: testConfig({ NODE_ENV: 'production' }),
      databasePing: upPing,
    });
    for (const url of ['/docs', '/docs-json']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(404);
      expect(res.headers['content-type']).toContain('application/problem+json');
    }
  });
});

describe('logging', () => {
  it('A-13 logs JSON with reqId and never the Authorization value', async () => {
    const { app, logLines, logs } = await start({ databasePing: upPing });
    await app.inject({
      method: 'GET',
      url: '/healthz',
      headers: { authorization: 'Bearer SECRETTOKEN', cookie: 'session=SECRETCOOKIE' },
    });

    expect(logLines.length).toBeGreaterThan(0);
    expect(logs().some((l) => typeof l['reqId'] === 'string')).toBe(true);
    const everything = logLines.join('\n');
    expect(everything).not.toContain('SECRETTOKEN');
    expect(everything).not.toContain('SECRETCOOKIE');
  });
});

describe('shutdown', () => {
  it('A-14 closing the app runs destroy hooks and stops listening', async () => {
    const onModuleDestroy = vi.fn();
    const { app } = await start({ databasePing: { ping: async () => undefined, onModuleDestroy } });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.getHttpServer().address() as { port: number };
    const base = `http://127.0.0.1:${address.port}`;
    expect((await fetch(`${base}/healthz`)).status).toBe(200);

    await app.close();
    current = undefined;

    expect(onModuleDestroy).toHaveBeenCalledTimes(1);
    await expect(fetch(`${base}/healthz`)).rejects.toThrow();
  });
});

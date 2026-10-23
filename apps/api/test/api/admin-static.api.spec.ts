import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';

/** Hosting: the API can also serve the built admin panel, without ever shadowing its own answers. */
let dir: string;
let app: TestApp;

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'rento-admin-'));
  mkdirSync(path.join(dir, 'assets'));
  writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>Rento Admin</title>');
  writeFileSync(path.join(dir, 'assets', 'app-abc123.js'), 'console.log(1)');
  writeFileSync(path.join(dir, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  app = await createTestApp({ config: testConfig({ ADMIN_STATIC_DIR: dir }) });
});
afterAll(async () => {
  await app.app.close();
  rmSync(dir, { recursive: true, force: true });
});

const get = (url: string) => app.app.inject({ method: 'GET', url });

describe('serving the admin panel from the API', () => {
  it('H-1 the panel’s pages (and a reload of any of them) all answer with the one HTML file, never cached', async () => {
    for (const page of ['/', '/login', '/bookings', '/inventory/models', '/account']) {
      const res = await get(page);
      expect(res.statusCode, page).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.headers['cache-control']).toBe('no-cache');
      expect(res.body).toContain('Rento Admin');
    }
  });

  it('H-2 hashed assets are served as files and cached for good; other files are always revalidated', async () => {
    const asset = await get('/assets/app-abc123.js');
    expect(asset.statusCode).toBe(200);
    expect(asset.headers['content-type']).toContain('javascript');
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    const icon = await get('/favicon.svg');
    expect(icon.statusCode).toBe(200);
    expect(icon.headers['cache-control']).toBe('no-cache');
  });

  it('H-3 the API is never shadowed: health, the API’s own 404 and its problem format stay as they were', async () => {
    const health = await get('/healthz');
    expect(health.statusCode).toBe(200);
    expect(health.headers['content-type']).toContain('application/json');
    const missing = await get('/v1/nothing-here');
    expect(missing.statusCode).toBe(404);
    expect(missing.headers['content-type']).toContain('application/problem+json');
    expect((await get('/v1/admin/me')).statusCode).toBe(401);
  });

  it('H-4 an address that is neither a page nor a file is a plain 404, not the panel', async () => {
    const res = await get('/no-such-page');
    expect(res.statusCode).toBe(404);
    expect(res.body).not.toContain('Rento Admin');
    expect((await get('/assets/missing.js')).statusCode).toBe(404);
  });

  it('H-5 starting with a folder that holds no built panel stops with a clear message', async () => {
    const empty = mkdtempSync(path.join(tmpdir(), 'rento-empty-'));
    await expect(
      createTestApp({ config: testConfig({ ADMIN_STATIC_DIR: empty }) }),
    ).rejects.toThrow(/no index\.html/);
    rmSync(empty, { recursive: true, force: true });
  });
});

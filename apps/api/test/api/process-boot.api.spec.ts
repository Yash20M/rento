import { type ChildProcess, spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const apiRoot = path.resolve(__dirname, '../..');
const mainJs = path.join(apiRoot, 'dist', 'main.js');

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

function run(env: Record<string, string>): { child: ChildProcess; output: () => string } {
  const child = spawn(process.execPath, [mainJs], {
    cwd: apiRoot,
    env: { PATH: process.env['PATH'] ?? '', SystemRoot: process.env['SystemRoot'] ?? '', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let buffer = '';
  child.stdout?.on('data', (chunk: Buffer) => (buffer += chunk.toString()));
  child.stderr?.on('data', (chunk: Buffer) => (buffer += chunk.toString()));
  return { child, output: () => buffer };
}

async function waitForHealthy(base: string, child: ChildProcess, output: () => string) {
  // Normal start-up is ~2.5 s; the budget is generous because this machine (OneDrive-synced folder, antivirus) can
  // stall a cold node start for many seconds, and a slow disk is not a product bug.
  const deadline = Date.now() + 75_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`process exited early:\n${output()}`);
    try {
      const res = await fetch(`${base}/healthz`);
      if (res.ok) return res;
    } catch {
      /* not listening yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`server never became healthy:\n${output()}`);
}

const started: ChildProcess[] = [];
afterEach(() => {
  for (const child of started.splice(0)) child.kill();
});

describe('built process', { timeout: 90_000 }, () => {
  it('P-01 boots from dist/, serves /healthz and a problem+json 404 over real HTTP', async () => {
    const port = await freePort();
    const { child, output } = run({
      NODE_ENV: 'test',
      HOST: '127.0.0.1',
      PORT: String(port),
      DATABASE_URL: 'postgres://rento:rento@127.0.0.1:1/rento',
      JWT_SECRET: 'process-boot-test-secret-0123456789abcdef',
    });
    started.push(child);
    const base = `http://127.0.0.1:${port}`;

    const health = await waitForHealthy(base, child, output);
    expect(await health.json()).toEqual({ status: 'ok' });

    const missing = await fetch(`${base}/v1/nope`);
    expect(missing.status).toBe(404);
    expect(missing.headers.get('content-type')).toContain('application/problem+json');

    const ready = await fetch(`${base}/readyz`);
    expect(ready.status).toBe(503);
  });

  it('P-02 refuses to boot on bad config: exit ≠ 0, names the key, leaks no secret', async () => {
    const { child, output } = run({
      NODE_ENV: 'test',
      PORT: 'abc',
      DATABASE_URL: 'postgres://rento:S3cretPass@127.0.0.1:5433/rento',
    });
    const code = await new Promise<number | null>((resolve) => child.once('exit', resolve));

    expect(code).not.toBe(0);
    expect(output()).toContain('PORT');
    expect(output()).not.toContain('S3cretPass');
  });
});

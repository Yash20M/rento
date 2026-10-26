// A throw-away copy of the platform for end-to-end tests: an empty database next to the dev Postgres, the real API on a
// free port, demo data created through the API, and (optionally) the admin panel. Used by `pnpm test:live-ui` and
// `pnpm test:live-android`. Your dev data is never touched; everything is stopped and dropped afterwards.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const isWindows = process.platform === 'win32';
export const pnpm = isWindows ? 'pnpm.cmd' : 'pnpm';
const { Client } = createRequire(path.join(root, 'apps/api/package.json'))('pg');

const PG_URL = process.env.LIVE_PG_URL ?? 'postgres://rento:rento@127.0.0.1:5433/postgres';

export const freePort = () =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

export const run = (command, args, options = {}) =>
  spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: isWindows, ...options });

/**
 * @param {{ admin?: boolean, host?: string }} options `admin`: also start the admin panel. `host`: the address the API
 *   listens on (an Android emulator reaches the computer as 10.0.2.2, so it needs 0.0.0.0).
 * @param {(stack: object) => Promise<number>} body returns the exit code
 */
export async function withLiveStack({ admin = false, host = '127.0.0.1' } = {}, body) {
  const dbName = `rento_live_${randomBytes(4).toString('hex')}`;
  const url = new URL(PG_URL);
  url.pathname = `/${dbName}`;
  const owner = {
    ADMIN_EMAIL: 'live.owner@rento.demo',
    ADMIN_PASSWORD: `Live-${randomBytes(9).toString('base64url')}!9`,
    ADMIN_NAME: 'Live Owner',
  };
  const children = [];
  let cleaned = false;

  async function cleanup() {
    if (cleaned) return;
    cleaned = true;
    for (const child of children) {
      if (isWindows)
        spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      else child.kill('SIGTERM');
    }
    const client = new Client({ connectionString: PG_URL });
    try {
      await client.connect();
      await client.query(
        'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
        [dbName],
      );
      await client.query(`DROP DATABASE IF EXISTS ${dbName}`);
    } catch (error) {
      console.error(`could not drop ${dbName}: ${error.message}`);
    } finally {
      await client.end().catch(() => {});
    }
  }
  const fail = async (message) => {
    console.error(`\n✖ ${message}`);
    await cleanup();
    process.exit(1);
  };
  process.on('SIGINT', () => cleanup().then(() => process.exit(130)));

  const say = (text) => console.log(`\n▶ ${text}`);
  const start = (command, args, options = {}) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: ['ignore', 'inherit', 'inherit'],
      shell: isWindows,
      ...options,
    });
    children.push(child);
    return child;
  };
  async function waitFor(target, label, seconds = 90) {
    const until = Date.now() + seconds * 1000;
    while (Date.now() < until) {
      try {
        if ((await fetch(target)).ok) return;
      } catch {
        /* not up yet */
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    await fail(`${label} did not come up within ${seconds}s.`);
  }

  try {
    const client = new Client({ connectionString: PG_URL });
    await client.connect().catch(async (error) => {
      await fail(
        `Postgres is not reachable at ${PG_URL.replace(/:[^:@/]*@/, ':***@')} (${error.message}). Run \`pnpm dev:db\`.`,
      );
    });
    await client.query(`CREATE DATABASE ${dbName}`);
    await client.end();

    const apiPort = await freePort();
    const adminPort = admin ? await freePort() : 0;
    const apiUrl = `http://127.0.0.1:${apiPort}`;
    const adminUrl = admin ? `http://127.0.0.1:${adminPort}` : undefined;
    const env = {
      ...process.env,
      ...owner,
      NODE_ENV: 'development',
      HOST: host,
      PORT: String(apiPort),
      DATABASE_URL: url.toString(),
      JWT_SECRET: randomBytes(32).toString('hex'),
      MAIL_FROM: 'Rento <no-reply@rento.example>',
      PUBLIC_WEB_URL: adminUrl ?? apiUrl,
      CORS_ALLOWED_ORIGINS: adminUrl ?? apiUrl,
      JOBS_INTERVAL_SECONDS: '0',
      RATE_LIMIT_ENABLED: 'false',
      // The specs sign in with the well-known demo password; a SEED_PASSWORD in the developer's .env must not change it.
      SEED_PASSWORD: 'Demo-Passw0rd!2026',
      LOG_LEVEL: 'warn',
      API_URL: apiUrl,
      API_PROXY_TARGET: apiUrl,
    };

    say(`Building the API and migrating ${dbName}`);
    if (run(pnpm, ['--filter', '@rento/api', 'build']).status !== 0)
      await fail('API build failed.');
    if (run('node', ['apps/api/dist/db/migrate-cli.js'], { env }).status !== 0)
      await fail('Migrations failed.');

    say(`Starting the API on ${apiUrl}`);
    start('node', ['apps/api/dist/main.js'], { env });
    await waitFor(`${apiUrl}/healthz`, 'The API');

    say('Creating demo data through the API');
    if (
      run('node', ['scripts/seed-demo.mjs'], { cwd: path.join(root, 'apps/api'), env }).status !== 0
    )
      await fail('Seeding failed.');

    if (admin) {
      say(`Starting the admin panel on ${adminUrl}`);
      start(
        pnpm,
        [
          '--filter',
          '@rento/admin',
          'exec',
          'vite',
          '--host',
          '127.0.0.1',
          '--port',
          String(adminPort),
          '--strictPort',
        ],
        { env },
      );
      await waitFor(`${adminUrl}/`, 'The admin panel');
    }

    const code = await body({
      env,
      apiUrl,
      apiPort,
      adminUrl,
      owner,
      demoPassword: 'Demo-Passw0rd!2026',
      say,
      fail,
    });
    await cleanup();
    process.exit(code);
  } catch (error) {
    await fail(error.stack ?? String(error));
  }
}

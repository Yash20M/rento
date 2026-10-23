// One command to run the whole demo on a developer machine:
//
//   pnpm demo              database + mail catcher, migrations, API, demo data, admin panel, customer app in Chrome
//   pnpm demo --no-app     everything except the Flutter app
//   pnpm demo --no-seed    do not (re)create demo data
//
// LOCAL DEVELOPMENT ONLY: it uses throw-away credentials and a fake payment gateway. Ctrl-C stops everything it started.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const isWindows = process.platform === 'win32';
const pnpm = isWindows ? 'pnpm.cmd' : 'pnpm';

const API_PORT = 3000;
const ADMIN_PORT = 5173;
const APP_PORT = 5555;
const env = {
  ...process.env,
  NODE_ENV: 'development',
  HOST: '127.0.0.1',
  PORT: String(API_PORT),
  DATABASE_URL: 'postgres://rento:rento@127.0.0.1:5433/rento',
  JWT_SECRET: 'demo-only-jwt-secret-0123456789abcdef0123',
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '1025',
  MAIL_FROM: 'Rento <no-reply@rento.example>',
  PUBLIC_WEB_URL: `http://localhost:${ADMIN_PORT}`,
  // The admin panel (browser session cookie, proxied by Vite) and the Flutter web app.
  CORS_ALLOWED_ORIGINS: [APP_PORT, ADMIN_PORT]
    .flatMap((port) => [`http://localhost:${port}`, `http://127.0.0.1:${port}`])
    .join(','),
  JOBS_INTERVAL_SECONDS: '30',
  LOG_LEVEL: 'warn',
};

const children = [];
const say = (text) => console.log(`\n▶ ${text}`);

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: isWindows,
    ...options,
  });
  if (result.status !== 0) {
    console.error(`\n✖ "${command} ${commandArgs.join(' ')}" failed.`);
    shutdown(1);
  }
}

function start(name, command, commandArgs, options = {}) {
  const child = spawn(command, commandArgs, {
    cwd: root,
    env,
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: isWindows,
    ...options,
  });
  child.on('exit', (code) => {
    if (!shuttingDown) console.error(`\n✖ ${name} stopped (exit ${code}).`);
  });
  children.push(child);
  return child;
}

let shuttingDown = false;
function shutdown(code = 0) {
  shuttingDown = true;
  for (const child of children) {
    if (isWindows)
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

async function waitFor(url, label, seconds = 90) {
  const until = Date.now() + seconds * 1000;
  while (Date.now() < until) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  console.error(`\n✖ ${label} did not come up within ${seconds}s.`);
  shutdown(1);
}

say('Starting PostgreSQL/PostGIS and the mail catcher (Docker)');
run(pnpm, ['dev:db']);

say('Building the API and applying database migrations');
run(pnpm, ['--filter', '@rento/api', 'build']);
run('node', ['apps/api/dist/db/migrate-cli.js'], { env });

say(`Starting the API on http://127.0.0.1:${API_PORT}`);
start('API', 'node', ['apps/api/dist/main.js']);
await waitFor(`http://127.0.0.1:${API_PORT}/healthz`, 'The API');

if (!args.has('--no-seed')) {
  say('Creating demo data (idempotent)');
  run('node', ['scripts/seed-demo.mjs'], { cwd: path.join(root, 'apps/api') });
}

say(`Starting the admin panel on http://127.0.0.1:${ADMIN_PORT}`);
start('Admin panel', pnpm, [
  '--filter',
  '@rento/admin',
  'exec',
  'vite',
  '--host',
  '127.0.0.1',
  '--port',
  String(ADMIN_PORT),
  '--strictPort',
]);
await waitFor(`http://127.0.0.1:${ADMIN_PORT}/`, 'The admin panel');

if (!args.has('--no-app')) {
  if (!existsSync(path.join(root, 'apps/mobile/pubspec.yaml'))) {
    console.error('The Flutter app is missing.');
  } else {
    say(
      `Starting the customer app in Chrome on http://localhost:${APP_PORT} (first start takes a minute)`,
    );
    start(
      'Customer app',
      'flutter',
      [
        'run',
        '-d',
        'chrome',
        '--web-port',
        String(APP_PORT),
        `--dart-define=API_BASE_URL=http://127.0.0.1:${API_PORT}`,
      ],
      { cwd: path.join(root, 'apps/mobile') },
    );
  }
}

console.log(`
────────────────────────────────────────────────────────────
  Rento demo is running

  Admin panel     http://127.0.0.1:${ADMIN_PORT}
  Customer app    http://localhost:${APP_PORT}   (opens in Chrome)
  API docs        http://127.0.0.1:${API_PORT}/docs
  Mail catcher    http://127.0.0.1:8025

  Super Admin     demo.admin@rento.demo       Demo-Passw0rd!2026
  Front desk      frontdesk@rento.demo        Demo-Passw0rd!2026
  Customer        demo.customer@rento.demo    Demo-Passw0rd!2026

  Walkthrough: docs/demo.md      Stop everything: Ctrl-C
────────────────────────────────────────────────────────────`);

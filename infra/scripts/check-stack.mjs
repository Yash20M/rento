// Asserts the local Docker stack (infra/compose.yaml) is up and correctly provisioned.
// Read-only: runs SELECTs and HTTP/TCP probes. Exits 1 on the first failed assertion.
import { execFileSync } from 'node:child_process';
import net from 'node:net';

const compose = ['compose', '-f', 'infra/compose.yaml'];

function fail(message) {
  console.error(`check:stack FAILED — ${message}`);
  process.exit(1);
}

function docker(args) {
  try {
    return execFileSync('docker', [...compose, ...args], { encoding: 'utf8' }).trim();
  } catch (error) {
    const detail = error instanceof Error ? error.message.split('\n')[0] : String(error);
    return fail(`docker ${args.join(' ')} -> ${detail} (is the stack running? try: pnpm dev:db)`);
  }
}

function assert(condition, message, failMessage = `expected: ${message}`) {
  if (!condition) fail(failMessage);
  console.log(`ok  ${message}`);
}

function tcpConnects(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: 2000 });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

// a. service health
const rows = docker(['ps', '--format', 'json'])
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line));
for (const service of ['db', 'mailpit']) {
  const row = rows.find((r) => r.Service === service);
  assert(
    row?.Health === 'healthy',
    `service "${service}" is healthy`,
    `service "${service}" is ${row?.Health ?? 'not running'}, expected healthy`,
  );
}

// b. extensions
const psql = (sql) =>
  docker(['exec', '-T', 'db', 'psql', '-U', 'rento', '-d', 'rento', '-tAc', sql]);
const extensions = psql('SELECT extname FROM pg_extension').split('\n');
for (const ext of ['postgis', 'btree_gist', 'pgcrypto']) {
  assert(extensions.includes(ext), `extension "${ext}" is installed`);
}

// c. longitude-first point convention
const wkt = psql('SELECT ST_AsText(ST_MakePoint(77.5946, 12.9716))');
assert(wkt === 'POINT(77.5946 12.9716)', 'ST_MakePoint(lng, lat) yields POINT(77.5946 12.9716)');

// d. mailpit
const info = await fetch('http://127.0.0.1:8025/api/v1/info').catch(() => null);
assert(info?.status === 200, 'Mailpit API answers 200 on :8025');
assert(await tcpConnects('127.0.0.1', 1025), 'Mailpit SMTP accepts connections on :1025');

console.log('check:stack passed');

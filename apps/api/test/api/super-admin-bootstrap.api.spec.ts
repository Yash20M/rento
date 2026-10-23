import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, testConfig, type TestApp } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';

const apiRoot = path.resolve(__dirname, '../..');
const mainJs = path.join(apiRoot, 'dist', 'cli', 'main.js');
const PASSWORD = 'a brand new passphrase 2030';

let database: TestDatabase;
let app: TestApp;
let counter = 0;

beforeAll(async () => {
  database = await createTestDatabase();
  app = await createTestApp({
    config: testConfig({ DATABASE_URL: database.url, PUBLIC_WEB_URL: 'https://app.rento.example' }),
  });
});
afterAll(async () => {
  await app.app.close();
  await database.drop();
});

const email = (tag = 'admin') => `${tag}-${(counter += 1)}-${Date.now()}@example.com`;
const resetAll = () =>
  database.pool.query(
    `DELETE FROM user_roles WHERE role_id IN (SELECT id FROM roles WHERE is_super_admin)`,
  );

/** Runs the real, built CLI as a child process against the test database. */
function cli(args: string[], env: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, [mainJs, ...args], {
    cwd: apiRoot,
    encoding: 'utf8',
    timeout: 60_000,
    env: {
      PATH: process.env['PATH'] ?? '',
      SystemRoot: process.env['SystemRoot'] ?? '',
      NODE_ENV: 'test',
      DATABASE_URL: database.url,
      JWT_SECRET: 'cli-test-jwt-secret-0123456789abcdef',
      PUBLIC_WEB_URL: 'https://app.rento.example',
      ...env,
    },
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}
const tokenIn = (stdout: string): string => {
  const match = /reset-password\?token=([A-Za-z0-9_%-]+)/.exec(stdout);
  if (!match?.[1]) throw new Error(`no setup link in:\n${stdout}`);
  return decodeURIComponent(match[1]);
};

describe('the built CLI', { timeout: 120_000 }, () => {
  // Each test starts real Node processes (several per test); a busy machine needs more than the default 30 s.
  it('K-1 bootstrap-super-admin creates the admin, prints one link, and exits 0 with a clean stderr', async () => {
    await resetAll();
    const address = email();
    const run = cli(['bootstrap-super-admin', '--email', address, '--name', 'First Admin']);

    expect(run.code).toBe(0);
    expect(run.stderr).toBe('');
    expect(run.stdout).toContain(`Created account ${address}`);
    expect(run.stdout.match(/reset-password\?token=/g)).toHaveLength(1);
    expect(run.stdout).not.toMatch(/^\s*password\s*[:=]/im);
    const role = await database.pool.query(
      `SELECT r.is_super_admin FROM user_roles ur JOIN roles r ON r.id = ur.role_id JOIN users u ON u.id = ur.user_id WHERE u.email = $1`,
      [address],
    );
    expect(role.rows).toEqual([{ is_super_admin: true }]);
  });

  it('K-2 the printed link sets the first password: sign-in works, the email becomes verified, the link is single use', async () => {
    await resetAll();
    const address = email();
    const token = tokenIn(cli(['bootstrap-super-admin', '--email', address]).stdout);

    const weak = await app.app.inject({
      method: 'POST',
      url: '/v1/auth/password/reset',
      payload: { token, newPassword: 'short' },
    });
    expect(weak.statusCode).toBe(422); // a weak password does not burn the link

    const reset = await app.app.inject({
      method: 'POST',
      url: '/v1/auth/password/reset',
      payload: { token, newPassword: PASSWORD },
    });
    expect(reset.statusCode).toBe(204);

    const login = await app.app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: address, password: PASSWORD },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json<{ user: { emailVerified: boolean } }>().user.emailVerified).toBe(true);

    const again = await app.app.inject({
      method: 'POST',
      url: '/v1/auth/password/reset',
      payload: { token, newPassword: 'another passphrase 2031' },
    });
    expect(again.statusCode).toBe(422);

    // and now the second CLI run has nothing to offer: no link, no change
    const second = cli(['bootstrap-super-admin', '--email', address]);
    expect(second.code).toBe(0);
    expect(second.stdout).toContain('already a Super Admin');
    expect(second.stdout).not.toContain('reset-password');
  });

  it('K-3 a second Super Admin is refused (exit 1) unless --force-additional is given', async () => {
    await resetAll();
    expect(cli(['bootstrap-super-admin', '--email', email('one')]).code).toBe(0);

    const refused = cli(['bootstrap-super-admin', '--email', email('two')]);
    expect(refused.code).toBe(1);
    expect(refused.stdout).toContain('--force-additional');

    const forced = cli(['bootstrap-super-admin', '--email', email('three'), '--force-additional']);
    expect(forced.code).toBe(0);
  });

  it('K-4 usage errors exit 2 and print help to stderr', () => {
    for (const args of [
      [],
      ['nope'],
      ['bootstrap-super-admin'],
      ['bootstrap-super-admin', '--email', 'x'],
    ]) {
      const run = cli(args);
      expect(run.code, JSON.stringify(args)).toBe(2);
      expect(run.stderr).toContain('Usage:');
      expect(run.stdout).toBe('');
    }
  });

  it('K-5 an unreachable database fails cleanly (exit 1) without printing the connection string', () => {
    const secretUrl = 'postgres://rento:S3cretPass@127.0.0.1:1/rento';
    const run = cli(['bootstrap-super-admin', '--email', email()], { DATABASE_URL: secretUrl });
    expect(run.code).toBe(1);
    expect(run.stderr).toContain('bootstrap-super-admin failed');
    expect(run.stderr + run.stdout).not.toContain('S3cretPass');
  });

  it('K-6 bad configuration exits 1 naming the key and no value', () => {
    const run = cli(['bootstrap-super-admin', '--email', email()], { JWT_SECRET: 'short' });
    expect(run.code).toBe(1);
    expect(run.stderr).toContain('JWT_SECRET');
    expect(run.stderr).not.toContain('short\n');
  });
});

describe('no HTTP route can create a Super Admin', () => {
  const spec = JSON.parse(
    readFileSync(path.resolve(apiRoot, '../../packages/contracts/openapi.json'), 'utf8'),
  ) as {
    paths: Record<string, Record<string, { requestBody?: unknown }>>;
    components: { schemas: Record<string, { properties?: Record<string, unknown> }> };
  };

  it('K-7 no path mentions bootstrap or super-admin creation', () => {
    for (const route of Object.keys(spec.paths)) {
      expect(route.toLowerCase(), route).not.toMatch(/bootstrap|super-?admin/);
    }
  });

  it('K-8 no REQUEST body (followed through nested schemas) can carry a role flag (isSystem / isSuperAdmin)', () => {
    type Schema = { $ref?: string; properties?: Record<string, Schema>; items?: Schema };
    const schemas = spec.components.schemas as Record<string, Schema>;
    const requestRoots = Object.values(spec.paths).flatMap((methods) =>
      Object.values(methods).flatMap((operation) => {
        const body = operation.requestBody as
          { content?: Record<string, { schema?: Schema }> } | undefined;
        return Object.values(body?.content ?? {}).flatMap((media) =>
          media.schema ? [media.schema] : [],
        );
      }),
    );
    expect(requestRoots.length).toBeGreaterThan(10); // the walk really found the request bodies

    const seen = new Set<string>();
    const visit = (schema: Schema | undefined, trail: string): void => {
      if (!schema) return;
      if (schema.$ref) {
        const name = schema.$ref.split('/').pop() as string;
        if (seen.has(name)) return;
        seen.add(name);
        visit(schemas[name], name);
        return;
      }
      for (const [property, child] of Object.entries(schema.properties ?? {})) {
        expect(['isSuperAdmin', 'isSystem'], `${trail}.${property}`).not.toContain(property);
        visit(child, trail + '.' + property);
      }
      visit(schema.items, trail + '[]');
    };
    for (const root of requestRoots) visit(root, 'request');
    expect(seen.has('CreateRoleDto')).toBe(true);
    expect(seen.has('RoleDto')).toBe(false); // responses are not request bodies
  });
});

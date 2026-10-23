import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ErrorCode } from '../../../apps/api/src/common/errors/error-codes';
import { createApiClient } from '../src/index';

const packageDir = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(packageDir, '../..');
const exporter = path.join(repoRoot, 'apps/api/dist/openapi-export.js');
const script = path.join(packageDir, 'scripts/contracts.mjs');
const committedSpec = path.join(packageDir, 'openapi.json');
const committedTypes = path.join(packageDir, 'src/generated/schema.d.ts');

const scratch = mkdtempSync(path.join(os.tmpdir(), 'rento-contracts-test-'));
// Inside the package so module resolution (openapi-fetch, typescript) works for the compile test.
const insidePackage = path.join(packageDir, 'test/.tmp');

function check(extraArgs: string[] = []) {
  return spawnSync(process.execPath, [script, 'check', '--skip-build', ...extraArgs], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

function exportTo(file: string, env: NodeJS.ProcessEnv = process.env) {
  return spawnSync(process.execPath, [exporter, file], { cwd: repoRoot, encoding: 'utf8', env });
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
const readJson = (file: string) =>
  JSON.parse(readFileSync(file, 'utf8')) as { [key: string]: Json };

/** Safe deep read: dig(spec, 'paths', '/healthz') — returns undefined if any step is missing. */
function dig(value: Json | undefined, ...keys: string[]): Json | undefined {
  return keys.reduce<Json | undefined>(
    (current, key) =>
      current !== null && typeof current === 'object' && !Array.isArray(current)
        ? current[key]
        : undefined,
    value,
  );
}
beforeAll(() => {
  const build = spawnSync('pnpm --filter @rento/api build', {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: true,
  });
  expect(build.status, build.stdout + build.stderr).toBe(0);
});

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
  rmSync(insidePackage, { recursive: true, force: true });
});

describe('export', () => {
  it('T-01 is deterministic: two runs are byte-identical', () => {
    const a = path.join(scratch, 'a.json');
    const b = path.join(scratch, 'b.json');
    expect(exportTo(a).status).toBe(0);
    expect(exportTo(b).status).toBe(0);
    expect(readFileSync(a, 'utf8')).toBe(readFileSync(b, 'utf8'));
  });

  it('T-02 needs no environment and no database', () => {
    const out = path.join(scratch, 'no-env.json');
    const result = exportTo(out, {
      PATH: process.env['PATH'] ?? '',
      SystemRoot: process.env['SystemRoot'] ?? '',
    });
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(out, 'utf8')).toBe(readFileSync(committedSpec, 'utf8'));
  });
});

describe('committed spec', () => {
  const spec = readJson(committedSpec);

  it('T-03 documents the health and auth endpoints', () => {
    expect(dig(spec, 'openapi')).toMatch(/^3./);
    expect(Object.keys(dig(spec, 'paths') as object).sort()).toEqual([
      '/healthz',
      '/readyz',
      '/v1/admin/admins',
      '/v1/admin/admins/invitations',
      '/v1/admin/admins/invitations/{id}',
      '/v1/admin/admins/{userId}',
      '/v1/admin/admins/{userId}/mfa',
      '/v1/admin/admins/{userId}/roles',
      '/v1/admin/assets',
      '/v1/admin/assets/{id}',
      '/v1/admin/assets/{id}/blocks',
      '/v1/admin/assets/{id}/blocks/{blockId}',
      '/v1/admin/assets/{id}/impact-preview',
      '/v1/admin/assets/{id}/transfer',
      '/v1/admin/assets/{id}/transfer/cancel',
      '/v1/admin/assets/{id}/transfer/complete',
      '/v1/admin/audit-logs',
      '/v1/admin/bookings',
      '/v1/admin/bookings/{id}',
      '/v1/admin/bookings/{id}/cancel',
      '/v1/admin/bookings/{id}/pickup',
      '/v1/admin/bookings/{id}/reassign',
      '/v1/admin/bookings/{id}/reassign-options',
      '/v1/admin/bookings/{id}/return',
      '/v1/admin/categories',
      '/v1/admin/categories/{id}',
      '/v1/admin/customers',
      '/v1/admin/customers/{id}',
      '/v1/admin/customers/{id}/kyc',
      '/v1/admin/customers/{id}/status',
      '/v1/admin/dashboard',
      '/v1/admin/drawers',
      '/v1/admin/drawers/{id}',
      '/v1/admin/drawers/{id}/closures',
      '/v1/admin/drawers/{id}/closures/{closureId}',
      '/v1/admin/drawers/{id}/hours',
      '/v1/admin/drawers/{id}/photo',
      '/v1/admin/drawers/{id}/schedule',
      '/v1/admin/item-models',
      '/v1/admin/item-models/{id}',
      '/v1/admin/item-models/{id}/photos',
      '/v1/admin/item-models/{id}/photos/{mediaId}',
      '/v1/admin/me',
      '/v1/admin/payments',
      '/v1/admin/permissions',
      '/v1/admin/reports/summary',
      '/v1/admin/roles',
      '/v1/admin/roles/{id}',
      '/v1/admin/settings',
      '/v1/admin/settings/discovery',
      '/v1/auth/admin-invitations/accept',
      '/v1/auth/admin-invitations/accept/google',
      '/v1/auth/email/verification/resend',
      '/v1/auth/email/verify',
      '/v1/auth/login',
      '/v1/auth/logout',
      '/v1/auth/password/forgot',
      '/v1/auth/password/reset',
      '/v1/auth/refresh',
      '/v1/auth/register',
      '/v1/auth/session/login',
      '/v1/auth/session/logout',
      '/v1/auth/session/mfa',
      '/v1/auth/session/mfa/disable',
      '/v1/auth/session/mfa/enrol',
      '/v1/auth/session/mfa/enrol/confirm',
      '/v1/auth/session/mfa/recovery-codes',
      '/v1/auth/session/mfa/verify',
      '/v1/auth/session/refresh',
      '/v1/auth/social/apple',
      '/v1/auth/social/facebook',
      '/v1/auth/social/google',
      '/v1/bookings',
      '/v1/bookings/{id}',
      '/v1/bookings/{id}/cancel',
      '/v1/bookings/{id}/extend',
      '/v1/bookings/{id}/extensions/{extensionId}/confirm',
      '/v1/bookings/{id}/extensions/{extensionId}/simulate',
      '/v1/bookings/{id}/payment',
      '/v1/bookings/{id}/payment/confirm',
      '/v1/bookings/{id}/payment/simulate',
      '/v1/categories',
      '/v1/drawers',
      '/v1/drawers/nearby',
      '/v1/drawers/{id}/inventory',
      '/v1/drawers/{id}/items/{modelId}/availability',
      '/v1/item-models',
      '/v1/item-models/{id}',
      '/v1/me',
      '/v1/me/avatar',
      '/v1/me/identities',
      '/v1/me/identities/apple',
      '/v1/me/identities/facebook',
      '/v1/me/identities/google',
      '/v1/me/identities/{provider}',
      '/v1/me/kyc',
      '/v1/me/kyc/aadhaar',
      '/v1/me/kyc/aadhaar/verify',
      '/v1/me/password',
      '/v1/media/{id}',
    ]);
  });

  it('T-04 has real response schemas and a problem+json 503', () => {
    expect(Object.keys(dig(spec, 'components', 'schemas') as object)).toEqual(
      expect.arrayContaining([
        'HealthResponseDto',
        'ReadinessResponseDto',
        'ProblemDetailsDto',
        'FieldErrorDto',
        'ErrorCode',
      ]),
    );
    const content503 = dig(spec, 'paths', '/readyz', 'get', 'responses', '503', 'content');
    expect(Object.keys(content503 as object)).toEqual(['application/problem+json']);
    expect(dig(content503, 'application/problem+json', 'schema', '$ref')).toBe(
      '#/components/schemas/ProblemDetailsDto',
    );
    expect(
      dig(
        spec,
        'paths',
        '/healthz',
        'get',
        'responses',
        '200',
        'content',
        'application/json',
        'schema',
        '$ref',
      ),
    ).toBe('#/components/schemas/HealthResponseDto');
  });

  it('T-10 the ErrorCode enum in the spec equals the API ErrorCode list', () => {
    const documented = dig(spec, 'components', 'schemas', 'ErrorCode', 'enum') as string[];
    expect([...documented].sort()).toEqual(Object.values(ErrorCode).sort());
  });
});

describe('contracts:check', () => {
  it('T-05 passes on the committed files', () => {
    const result = check();
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain('contracts:check passed');
  });

  it('T-06 fails when openapi.json has drifted, naming the file and the fix', () => {
    const tampered = path.join(scratch, 'openapi.json');
    const spec = readJson(committedSpec);
    (spec['info'] as { title: string }).title = 'Rento API (edited by hand)';
    writeFileSync(tampered, `${JSON.stringify(spec, null, 2)}\n`);

    const result = check(['--spec', tampered]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('spec drift');
    expect(result.stderr).toContain('pnpm contracts:generate');
  });

  it('T-06b fails when the committed spec is missing', () => {
    const result = check(['--spec', path.join(scratch, 'does-not-exist.json')]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('is missing');
  });

  it('T-07 fails when the generated types have drifted', () => {
    const tampered = path.join(scratch, 'schema.d.ts');
    writeFileSync(
      tampered,
      `${readFileSync(committedTypes, 'utf8')}\nexport type Sneaky = string;\n`,
    );

    const result = check(['--types', tampered]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('types drift');
  });

  it('T-08 fails when the typed client no longer compiles', () => {
    const dir = path.join(insidePackage, 'broken');
    mkdirSync(dir, { recursive: true });
    cpSync(path.join(packageDir, 'src'), path.join(dir, 'src'), { recursive: true });
    writeFileSync(
      path.join(dir, 'src/broken-usage.ts'),
      "import { createApiClient } from './index';\nexport const bad: number = createApiClient('x');\n",
    );
    writeFileSync(
      path.join(dir, 'tsconfig.json'),
      JSON.stringify({ extends: '@rento/config/tsconfig.base.json', include: ['src'] }),
    );

    const result = check(['--tsconfig', path.join(dir, 'tsconfig.json')]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('does not compile');
    expect(result.stderr).toContain('broken-usage.ts');
  });
});

describe('typed client', () => {
  it('T-09 builds URLs from the base and returns parsed, typed data', async () => {
    const requested: string[] = [];
    const client = createApiClient('http://api.test', {
      fetch: async (request: Request) => {
        requested.push(request.url);
        return new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });

    const { data, error } = await client.GET('/healthz');
    expect(requested).toEqual(['http://api.test/healthz']);
    expect(error).toBeUndefined();
    expect(data).toEqual({ status: 'ok' });
  });

  it('T-09b surfaces problem+json errors as typed `error`', async () => {
    const problem = {
      type: 'urn:rento:problem:retry-later',
      title: 'Service Unavailable',
      status: 503,
      code: 'RETRY_LATER',
      detail: 'Database unavailable',
      traceId: 'trace-1',
    };
    const client = createApiClient('http://api.test', {
      fetch: async () =>
        new Response(JSON.stringify(problem), {
          status: 503,
          headers: { 'content-type': 'application/problem+json' },
        }),
    });

    const { data, error } = await client.GET('/readyz');
    expect(data).toBeUndefined();
    expect(error?.code).toBe('RETRY_LATER');
  });
});

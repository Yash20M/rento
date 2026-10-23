import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { base32Decode, codeFor, stepOf } from '../../src/modules/auth-users/domain/totp';
import { makeSuperAdmin } from '../support/access';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeClock } from '../support/fake-clock';
import { TEST_PASSWORD, registerSession } from '../support/sessions';

/**
 * P4-05 — two-step verification for administrators, through the public HTTP contract: setting it up, proving it, the
 * limits of a session that has not, and the extra proof the sensitive actions ask for.
 */
const START = '2030-01-07T03:00:00Z';

let database: TestDatabase;
let app: TestApp;
let clock: FakeClock;
let counter = 0;

beforeAll(async () => {
  database = await createTestDatabase();
  clock = new FakeClock(START);
  app = await createTestApp({
    config: testConfig({
      DATABASE_URL: database.url,
      ADMIN_MFA_REQUIRED: 'true',
      STEP_UP_MAX_AGE_SECONDS: '600',
    }),
    clock,
  });
});
afterAll(async () => {
  await app.app.close();
  await database.drop();
});

interface Admin {
  email: string;
  userId: string;
  token: string;
  cookie: string;
  secret?: Buffer;
}

const WEB = { 'x-requested-with': 'rento-web' };
const call = (
  who: Admin | undefined,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  payload?: Record<string, unknown>,
  headers: Record<string, string> = {},
) =>
  app.app.inject({
    method,
    url,
    headers: {
      ...(who && { authorization: `Bearer ${who.token}` }),
      ...(who && url.includes('/auth/session') && { ...WEB, cookie: who.cookie }),
      ...headers,
    },
    ...(payload !== undefined && { payload }),
  });

/** A new Super Admin who signs in the way the admin panel does (cookie session). */
async function newAdmin(): Promise<Admin> {
  const registered = await registerSession(app, clock, `mfa-${(counter += 1)}`);
  await makeSuperAdmin(database.pool, registered.user.id);
  const login = await app.app.inject({
    method: 'POST',
    url: '/v1/auth/session/login',
    headers: WEB,
    payload: { email: registered.email, password: TEST_PASSWORD },
  });
  expect(login.statusCode, login.body).toBe(200);
  return {
    email: registered.email,
    userId: registered.user.id,
    token: login.json<{ accessToken: string }>().accessToken,
    cookie: String(login.headers['set-cookie']).split(';')[0]!,
  };
}

const codeNow = (admin: Admin, offsetSteps = 0) =>
  codeFor(admin.secret!, stepOf(clock.now()) + offsetSteps);

/** Sets two-step verification up completely; the admin's token afterwards counts as verified. */
async function enrol(admin: Admin): Promise<string[]> {
  const begin = await call(admin, 'POST', '/v1/auth/session/mfa/enrol', {
    password: TEST_PASSWORD,
  });
  expect(begin.statusCode, begin.body).toBe(200);
  admin.secret = base32Decode(begin.json<{ secret: string }>().secret);
  const confirm = await call(admin, 'POST', '/v1/auth/session/mfa/enrol/confirm', {
    code: codeNow(admin),
  });
  expect(confirm.statusCode, confirm.body).toBe(200);
  const body = confirm.json<{ accessToken: string; recoveryCodes: string[] }>();
  admin.token = body.accessToken;
  return body.recoveryCodes;
}

const advance = (seconds: number) => clock.set(new Date(clock.now().getTime() + seconds * 1000));

describe('setting it up', () => {
  it('M-1 needs the password; a wrong one changes nothing', async () => {
    const admin = await newAdmin();
    const wrong = await call(admin, 'POST', '/v1/auth/session/mfa/enrol', { password: 'not it' });
    expect(wrong.statusCode).toBe(401);
    expect((await call(admin, 'GET', '/v1/auth/session/mfa')).json()).toEqual({
      enrolled: false,
      recoveryCodesLeft: 0,
    });
  });

  it('M-2 the secret protects nothing until a right code confirms it; a wrong code is explained', async () => {
    const admin = await newAdmin();
    const begin = await call(admin, 'POST', '/v1/auth/session/mfa/enrol', {
      password: TEST_PASSWORD,
    });
    const body = begin.json<{ secret: string; otpauthUri: string }>();
    expect(body.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(body.otpauthUri).toContain(`secret=${body.secret}`);
    expect(body.otpauthUri).toContain(encodeURIComponent(admin.email));
    admin.secret = base32Decode(body.secret);

    expect((await call(admin, 'GET', '/v1/auth/session/mfa')).json()).toMatchObject({
      enrolled: false,
    });
    const wrong = await call(admin, 'POST', '/v1/auth/session/mfa/enrol/confirm', {
      code: '000000',
    });
    expect(wrong.statusCode).toBe(422);
    expect(wrong.json<{ errors: Array<{ field: string }> }>().errors[0]!.field).toBe('code');
    expect((await call(admin, 'GET', '/v1/auth/session/mfa')).json()).toMatchObject({
      enrolled: false,
    });
  });

  it('M-3 a right code switches it on, shows ten recovery codes once, and the secret is stored encrypted', async () => {
    const admin = await newAdmin();
    const codes = await enrol(admin);
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) expect(code).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
    expect(await call(admin, 'GET', '/v1/auth/session/mfa').then((r) => r.json())).toEqual({
      enrolled: true,
      recoveryCodesLeft: 10,
    });

    const stored = await database.pool.query(
      'SELECT secret_enc FROM user_mfa_totp WHERE user_id = $1',
      [admin.userId],
    );
    const text = stored.rows[0].secret_enc as string;
    expect(text).not.toContain(admin.secret!.toString('base64url'));
    const hashes = await database.pool.query(
      'SELECT code_hash FROM user_mfa_recovery_codes WHERE user_id = $1',
      [admin.userId],
    );
    expect(JSON.stringify(hashes.rows)).not.toContain(codes[0]!.replace('-', ''));

    const again = await call(admin, 'POST', '/v1/auth/session/mfa/enrol', {
      password: TEST_PASSWORD,
    });
    expect(again.statusCode).toBe(409);
  });
});

describe('what a session may do', () => {
  it('M-4 without the second step the panel is closed except for the call that says what to do', async () => {
    const admin = await newAdmin();
    const me = await call(admin, 'GET', '/v1/admin/me');
    expect(me.statusCode).toBe(200);
    expect(me.json<{ mfa: unknown }>().mfa).toEqual({
      required: true,
      enrolled: false,
      verified: false,
    });
    const blocked = await call(admin, 'GET', '/v1/admin/drawers');
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json<{ code: string }>().code).toBe('MFA_REQUIRED');
  });

  it('M-5 once set up the session counts as verified, and a refresh keeps it', async () => {
    const admin = await newAdmin();
    await enrol(admin);
    expect((await call(admin, 'GET', '/v1/admin/drawers')).statusCode).toBe(200);
    expect((await call(admin, 'GET', '/v1/admin/me')).json<{ mfa: unknown }>().mfa).toEqual({
      required: true,
      enrolled: true,
      verified: true,
    });

    const refreshed = await app.app.inject({
      method: 'POST',
      url: '/v1/auth/session/refresh',
      headers: { ...WEB, cookie: admin.cookie },
    });
    expect(refreshed.statusCode, refreshed.body).toBe(200);
    admin.token = refreshed.json<{ accessToken: string }>().accessToken;
    admin.cookie = String(refreshed.headers['set-cookie']).split(';')[0]!;
    expect((await call(admin, 'GET', '/v1/admin/drawers')).statusCode).toBe(200);
  });

  it('M-6 signing in again starts unverified: the code is asked for, and a right one opens the panel', async () => {
    const admin = await newAdmin();
    await enrol(admin);
    advance(61); // past the step the enrolment used
    const again = await app.app.inject({
      method: 'POST',
      url: '/v1/auth/session/login',
      headers: WEB,
      payload: { email: admin.email, password: TEST_PASSWORD },
    });
    const next: Admin = {
      ...admin,
      token: again.json<{ accessToken: string }>().accessToken,
      cookie: String(again.headers['set-cookie']).split(';')[0]!,
    };
    expect((await call(next, 'GET', '/v1/admin/drawers')).json<{ code: string }>().code).toBe(
      'MFA_REQUIRED',
    );

    const verified = await call(next, 'POST', '/v1/auth/session/mfa/verify', {
      code: codeNow(admin),
    });
    expect(verified.statusCode, verified.body).toBe(200);
    next.token = verified.json<{ accessToken: string }>().accessToken;
    expect((await call(next, 'GET', '/v1/admin/drawers')).statusCode).toBe(200);
  });
});

describe('proving it', () => {
  it('M-7 a wrong code is refused; a code that was already used is refused; the next one works', async () => {
    const admin = await newAdmin();
    await enrol(admin); // used the current step
    expect(
      (await call(admin, 'POST', '/v1/auth/session/mfa/verify', { code: '123456' })).statusCode,
    ).toBe(422);
    const replay = await call(admin, 'POST', '/v1/auth/session/mfa/verify', {
      code: codeNow(admin),
    });
    expect(replay.statusCode, 'the code from the enrolment is spent').toBe(422);

    advance(30);
    const next = await call(admin, 'POST', '/v1/auth/session/mfa/verify', {
      code: codeNow(admin),
    });
    expect(next.statusCode, next.body).toBe(200);
    const again = await call(admin, 'POST', '/v1/auth/session/mfa/verify', {
      code: codeNow(admin),
    });
    expect(again.statusCode, 'and that one is spent too').toBe(422);
  });

  it('M-8 a recovery code works once, in any typing, and then never again', async () => {
    const admin = await newAdmin();
    const codes = await enrol(admin);
    const typed = codes[0]!.toLowerCase().replace('-', ' ');
    const ok = await call(admin, 'POST', '/v1/auth/session/mfa/verify', { recoveryCode: typed });
    expect(ok.statusCode, ok.body).toBe(200);
    const twice = await call(admin, 'POST', '/v1/auth/session/mfa/verify', {
      recoveryCode: codes[0],
    });
    expect(twice.statusCode).toBe(422);
    expect((await call(admin, 'GET', '/v1/auth/session/mfa')).json()).toMatchObject({
      recoveryCodesLeft: 9,
    });
    const other = await call(admin, 'POST', '/v1/auth/session/mfa/verify', {
      recoveryCode: 'AAAAA-AAAAA',
    });
    expect(other.statusCode).toBe(422);
  });

  it('M-9 a session cannot be verified with someone else’s cookie', async () => {
    const mine = await newAdmin();
    const theirs = await newAdmin();
    await enrol(mine);
    advance(31);
    const stolen = await call(
      { ...mine, cookie: theirs.cookie },
      'POST',
      '/v1/auth/session/mfa/verify',
      { code: codeNow(mine) },
    );
    expect(stolen.statusCode).toBe(401);
    const noCsrf = await app.app.inject({
      method: 'POST',
      url: '/v1/auth/session/mfa/verify',
      headers: { authorization: `Bearer ${mine.token}`, cookie: mine.cookie },
      payload: { code: codeNow(mine) },
    });
    expect(noCsrf.statusCode).toBe(403);
  });
});

describe('sensitive actions', () => {
  it('M-10 roles, staff and refunds need a recent proof: fresh passes, stale asks again, a new code fixes it', async () => {
    const admin = await newAdmin();
    await enrol(admin);
    const makeRole = (name: string) =>
      call(admin, 'POST', '/v1/admin/roles', { name, permissions: ['drawers:read'] });
    expect((await makeRole('Fresh role')).statusCode).toBe(201);

    advance(660); // the proof is now 11 minutes old (limit 10); the access token is still valid
    const stale = await makeRole('Stale role');
    expect(stale.statusCode).toBe(403);
    expect(stale.json<{ code: string }>().code).toBe('STEP_UP_REQUIRED');
    // ordinary admin work is not interrupted
    expect((await call(admin, 'GET', '/v1/admin/drawers')).statusCode).toBe(200);

    const proved = await call(admin, 'POST', '/v1/auth/session/mfa/verify', {
      code: codeNow(admin),
    });
    expect(proved.statusCode, proved.body).toBe(200);
    admin.token = proved.json<{ accessToken: string }>().accessToken;
    expect((await makeRole('Stale role')).statusCode).toBe(201);
  });
});

describe('turning it off and recovering', () => {
  it('M-11 an administrator cannot turn it off while it is required; the codes can be replaced', async () => {
    const admin = await newAdmin();
    const first = await enrol(admin);
    advance(31);
    const off = await call(admin, 'POST', '/v1/auth/session/mfa/disable', {
      password: TEST_PASSWORD,
      code: codeNow(admin),
    });
    expect(off.statusCode).toBe(409);

    advance(31);
    const fresh = await call(admin, 'POST', '/v1/auth/session/mfa/recovery-codes', {
      password: TEST_PASSWORD,
      code: codeNow(admin),
    });
    expect(fresh.statusCode, fresh.body).toBe(200);
    const codes = fresh.json<{ recoveryCodes: string[] }>().recoveryCodes;
    expect(codes).toHaveLength(10);
    expect(codes.some((c) => first.includes(c))).toBe(false);
    const old = await call(admin, 'POST', '/v1/auth/session/mfa/verify', {
      recoveryCode: first[0],
    });
    expect(old.statusCode, 'the old codes stopped working').toBe(422);
  });

  it('M-12 someone with admins:manage can reset a colleague who lost their phone; they set it up again', async () => {
    const boss = await newAdmin();
    await enrol(boss);
    const colleague = await newAdmin();
    await enrol(colleague);

    const reset = await call(boss, 'DELETE', `/v1/admin/admins/${colleague.userId}/mfa`);
    expect(reset.statusCode, reset.body).toBe(204);
    const stored = await database.pool.query(
      'SELECT count(*)::int AS n FROM user_mfa_totp WHERE user_id = $1',
      [colleague.userId],
    );
    expect(stored.rows[0].n).toBe(0);
    const audit = await database.pool.query(
      `SELECT actor_id FROM audit_logs WHERE action = 'admin.mfa_reset' AND entity_id = $1`,
      [colleague.userId],
    );
    expect(audit.rows).toEqual([{ actor_id: boss.userId }]);

    // their next sign-in is closed again until they set it up anew
    advance(31);
    const login = await app.app.inject({
      method: 'POST',
      url: '/v1/auth/session/login',
      headers: WEB,
      payload: { email: colleague.email, password: TEST_PASSWORD },
    });
    const again: Admin = {
      ...colleague,
      token: login.json<{ accessToken: string }>().accessToken,
      cookie: String(login.headers['set-cookie']).split(';')[0]!,
    };
    expect((await call(again, 'GET', '/v1/admin/drawers')).statusCode).toBe(403);
    await enrol(again);
    expect((await call(again, 'GET', '/v1/admin/drawers')).statusCode).toBe(200);
  });
});

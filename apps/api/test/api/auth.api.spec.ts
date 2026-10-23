import { createHash } from 'node:crypto';
import { SignJWT, decodeJwt } from 'jose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PasswordHasher } from '../../src/modules/auth-users';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeClock } from '../support/fake-clock';

const PASSWORD = 'correct horse battery staple';
const START = '2030-01-01T00:00:00Z';
const DAY_MS = 24 * 60 * 60 * 1000;

interface AuthBody {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: { id: string; email: string; displayName: string; emailVerified: boolean };
}
interface ProblemBody {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  errors?: Array<{ field: string; message: string }>;
  traceId: string;
}

let database: TestDatabase;
let current: TestApp;
let clock: FakeClock;
let counter = 0;

beforeAll(async () => {
  database = await createTestDatabase();
  clock = new FakeClock(START);
  current = await createTestApp({
    config: testConfig({ DATABASE_URL: database.url }),
    clock,
  });
});
afterAll(async () => {
  await current.app.close();
  await database.drop();
});
beforeEach(() => {
  clock.set(START);
});

const uniqueEmail = (tag = 'user') => `${tag}-${(counter += 1)}-${Date.now()}@example.com`;
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

const post = (
  url: string,
  payload?: Record<string, unknown>,
  headers: Record<string, string> = {},
) =>
  current.app.inject({ method: 'POST', url, ...(payload !== undefined && { payload }), headers });

async function register(overrides: Record<string, unknown> = {}) {
  const body = { email: uniqueEmail(), password: PASSWORD, name: 'Asha Rao', ...overrides };
  const res = await post('/v1/auth/register', body);
  return { res, body, json: res.json<AuthBody>() };
}

const whoami = (authorization?: string) =>
  current.app.inject({
    method: 'GET',
    url: '/v1/__test/whoami',
    ...(authorization !== undefined && { headers: { authorization } }),
  });

async function tokenRow(refreshToken: string) {
  return database.db
    .selectFrom('refresh_tokens')
    .selectAll()
    .where('token_hash', '=', sha256(refreshToken))
    .executeTakeFirstOrThrow();
}

async function familyRows(familyId: string) {
  return database.db
    .selectFrom('refresh_tokens')
    .selectAll()
    .where('family_id', '=', familyId)
    .orderBy('created_at')
    .execute();
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────
describe('POST /v1/auth/register', () => {
  it('A-01 creates an account and signs the user in', async () => {
    const { res, json, body } = await register();

    expect(res.statusCode).toBe(201);
    expect(Object.keys(json).sort()).toEqual(
      ['accessToken', 'expiresIn', 'refreshToken', 'tokenType', 'user'].sort(),
    );
    expect(json.tokenType).toBe('Bearer');
    expect(json.expiresIn).toBe(900);
    expect(json.user).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      email: body.email,
      displayName: 'Asha Rao',
      emailVerified: false,
      avatarUrl: null,
    });
    expect(res.body).not.toMatch(/hash|"password"/i);
  });

  it('A-02 stores an Argon2id hash and a hashed refresh token — never the secrets themselves', async () => {
    const { json } = await register({ phone: '+919876543210' });
    const userId = json.user.id;

    const user = await database.db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', userId)
      .executeTakeFirstOrThrow();
    expect(user).toMatchObject({
      status: 'active',
      display_name: 'Asha Rao',
      phone: '+919876543210',
    });
    expect(user.email_verified_at).toBeNull();

    const identity = await database.db
      .selectFrom('user_identities')
      .selectAll()
      .where('user_id', '=', userId)
      .executeTakeFirstOrThrow();
    expect(identity.provider).toBe('password');
    expect(identity.provider_subject).toBe(userId);
    expect(identity.password_hash).toMatch(/^\$argon2id\$/);
    expect(identity.password_hash).not.toContain(PASSWORD);

    const row = await tokenRow(json.refreshToken);
    expect(row.token_hash).not.toBe(json.refreshToken);
    expect(row.user_id).toBe(userId);
    const raw = await database.pool.query('SELECT 1 FROM refresh_tokens WHERE token_hash = $1', [
      json.refreshToken,
    ]);
    expect(raw.rowCount).toBe(0);
    const expected = new Date(new Date(START).getTime() + 30 * DAY_MS);
    expect(row.expires_at).toEqual(expected);
    expect(row.family_expires_at).toEqual(expected);
    expect(row.revoked_at).toBeNull();
  });

  it('A-03 rejects a duplicate email regardless of case with 409 EMAIL_TAKEN', async () => {
    const email = uniqueEmail('dup');
    expect((await register({ email })).res.statusCode).toBe(201);

    const second = await register({ email: email.toUpperCase() });
    expect(second.res.statusCode).toBe(409);
    expect(second.res.headers['content-type']).toContain('application/problem+json');
    expect(second.res.json<ProblemBody>()).toMatchObject({ code: 'EMAIL_TAKEN', status: 409 });

    const count = await database.pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
    expect(count.rowCount).toBe(1);
  });

  it('A-04 ten simultaneous registrations of one email → exactly one wins, no 5xx', async () => {
    const email = uniqueEmail('race');
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        post('/v1/auth/register', { email, password: PASSWORD, name: 'Racer' }),
      ),
    );
    const statuses = results.map((r) => r.statusCode).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(9);
    expect(statuses.filter((s) => s >= 500)).toHaveLength(0);

    const users = await database.pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
    expect(users.rowCount).toBe(1);
    const identities = await database.pool.query(
      `SELECT 1 FROM user_identities i JOIN users u ON u.id = i.user_id WHERE u.email = $1`,
      [email],
    );
    expect(identities.rowCount).toBe(1);
  });

  it.each([
    ['too short', 'short123'],
    ['common', 'Password123'],
    ['single repeated character', 'zzzzzzzzzzzz'],
    ['129 characters', 'xK9#'.repeat(32) + 'y'],
  ])('A-05 weak password (%s) → 422 on the password field', async (_label, password) => {
    const { res } = await register({ password });
    expect(res.statusCode).toBe(422);
    const body = res.json<ProblemBody>();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.errors?.map((e) => e.field)).toContain('password');
  });

  it('A-05b a password equal to the email → 422', async () => {
    const email = uniqueEmail('same');
    const { res } = await register({ email, password: email });
    expect(res.statusCode).toBe(422);
    expect(res.json<ProblemBody>().errors?.[0]?.message).toMatch(/same as your email/i);
  });

  it.each([
    ['bad email', { email: 'not-an-email' }, 'email'],
    ['empty name', { name: '' }, 'name'],
    ['101-character name', { name: 'n'.repeat(101) }, 'name'],
    ['bad phone', { phone: '12345' }, 'phone'],
    ['missing password', { password: undefined }, 'password'],
  ])('A-06 %s → 422 naming the field', async (_label, override, field) => {
    const { res } = await register(override);
    expect(res.statusCode).toBe(422);
    expect(res.json<ProblemBody>().errors?.map((e) => e.field)).toContain(field);
  });

  it('A-07 unknown fields (mass assignment) are rejected and nothing is created', async () => {
    const email = uniqueEmail('mass');
    const { res } = await register({ email, role: 'admin', isAdmin: true, status: 'active' });
    expect(res.statusCode).toBe(422);
    const fields = res.json<ProblemBody>().errors?.map((e) => e.field) ?? [];
    expect(fields).toEqual(expect.arrayContaining(['role', 'isAdmin']));
    const created = await database.pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
    expect(created.rowCount).toBe(0);
  });

  it('A-08 trims and lower-cases the email', async () => {
    const tag = uniqueEmail('Mixed.Case').toUpperCase();
    const { res, json } = await register({ email: `  ${tag}  ` });
    expect(res.statusCode).toBe(201);
    expect(json.user.email).toBe(tag.toLowerCase());
  });
});

// ──────────────────────────────────────────────────────────────────────────────────────────────────
describe('POST /v1/auth/login', () => {
  it('A-09 signs in (email is case-insensitive) and starts a new session', async () => {
    const { body, json: registered } = await register();
    const res = await post('/v1/auth/login', {
      email: String(body.email).toUpperCase(),
      password: PASSWORD,
    });

    expect(res.statusCode).toBe(200);
    const json = res.json<AuthBody>();
    expect(json.user.id).toBe(registered.user.id);
    expect(json.refreshToken).not.toBe(registered.refreshToken);
    const [first, second] = [
      await tokenRow(registered.refreshToken),
      await tokenRow(json.refreshToken),
    ];
    expect(second.family_id).not.toBe(first.family_id);
  });

  it('A-10 wrong password and unknown email are indistinguishable', async () => {
    const { body } = await register();
    const wrongPassword = await post('/v1/auth/login', {
      email: body.email,
      password: 'wrong password 123',
    });
    const unknownEmail = await post('/v1/auth/login', {
      email: uniqueEmail('ghost'),
      password: 'wrong password 123',
    });

    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownEmail.statusCode).toBe(401);
    const strip = (p: ProblemBody) => ({
      type: p.type,
      title: p.title,
      status: p.status,
      code: p.code,
      detail: p.detail,
    });
    expect(strip(wrongPassword.json<ProblemBody>())).toEqual(
      strip(unknownEmail.json<ProblemBody>()),
    );
    expect(wrongPassword.json<ProblemBody>()).toMatchObject({
      code: 'UNAUTHENTICATED',
      detail: 'Invalid email or password',
    });
  });

  it.each(['suspended', 'deleted'])(
    'A-11 a %s user cannot sign in, with the same generic 401',
    async (status) => {
      const { body, json } = await register();
      await database.pool.query('UPDATE users SET status = $1 WHERE id = $2', [
        status,
        json.user.id,
      ]);

      const res = await post('/v1/auth/login', { email: body.email, password: PASSWORD });
      expect(res.statusCode).toBe(401);
      expect(res.json<ProblemBody>().detail).toBe('Invalid email or password');
    },
  );

  it('A-11b a user without a password identity (social-only) cannot sign in with a password', async () => {
    const email = uniqueEmail('social');
    await database.pool.query(`INSERT INTO users (email) VALUES ($1)`, [email]);
    const res = await post('/v1/auth/login', { email, password: PASSWORD });
    expect(res.statusCode).toBe(401);
    expect(res.json<ProblemBody>().detail).toBe('Invalid email or password');
  });

  it('A-12 an unknown email still costs one Argon2 verification (timing parity)', async () => {
    const hasher = current.app.get(PasswordHasher);
    const spy = vi.spyOn(hasher, 'verify');
    try {
      await post('/v1/auth/login', { email: uniqueEmail('nobody'), password: 'some password 123' });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(String(spy.mock.calls[0]?.[0])).toMatch(/^\$argon2id\$/);
    } finally {
      spy.mockRestore();
    }
  });

  it('A-13 missing fields → 422', async () => {
    expect((await post('/v1/auth/login', { email: 'a@example.com' })).statusCode).toBe(422);
    expect((await post('/v1/auth/login', { password: PASSWORD })).statusCode).toBe(422);
    expect((await post('/v1/auth/login', {})).statusCode).toBe(422);
  });
});

// ──────────────────────────────────────────────────────────────────────────────────────────────────
describe('access tokens & AccessTokenGuard', () => {
  it('A-14 no token → 401 UNAUTHENTICATED', async () => {
    const res = await whoami();
    expect(res.statusCode).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json<ProblemBody>().code).toBe('UNAUTHENTICATED');
  });

  it.each([
    'Basic dXNlcjpwYXNz',
    'Bearer',
    'Bearer ',
    'Bearer a b',
    'bearer not.a.jwt',
    'Token abc',
  ])('A-15 malformed credentials %j → 401', async (header) => {
    const res = await whoami(header);
    expect(res.statusCode).toBe(401);
    expect(res.json<ProblemBody>().code).toBe('UNAUTHENTICATED');
  });

  it('A-19 a valid token reaches the handler with the right identity', async () => {
    const { json } = await register();
    const res = await whoami(`Bearer ${json.accessToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      sub: json.user.id,
      tokenId: decodeJwt(json.accessToken).jti,
    });
  });

  it('A-16 an expired token → 401 TOKEN_EXPIRED', async () => {
    const { json } = await register();
    clock.advance(16 * 60 * 1000);
    const res = await whoami(`Bearer ${json.accessToken}`);
    expect(res.statusCode).toBe(401);
    expect(res.json<ProblemBody>().code).toBe('TOKEN_EXPIRED');
  });

  it('A-17 a token signed with a different secret → 401', async () => {
    const { json } = await register();
    const iat = Math.floor(clock.now().getTime() / 1000);
    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(json.user.id)
      .setIssuer('rento-api')
      .setAudience('rento-clients')
      .setIssuedAt(iat)
      .setExpirationTime(iat + 900)
      .setJti('attacker')
      .sign(new TextEncoder().encode('attacker-secret-0123456789abcdefghij'));
    const res = await whoami(`Bearer ${forged}`);
    expect(res.statusCode).toBe(401);
    expect(res.json<ProblemBody>().code).toBe('UNAUTHENTICATED');
  });

  it('A-18 an unsigned alg=none token claiming a real user → 401', async () => {
    const { json } = await register();
    const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const iat = Math.floor(clock.now().getTime() / 1000);
    const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
      sub: json.user.id,
      iss: 'rento-api',
      aud: 'rento-clients',
      iat,
      exp: iat + 900,
      jti: 'x',
    })}.`;
    const res = await whoami(`Bearer ${unsigned}`);
    expect(res.statusCode).toBe(401);
    expect(res.json<ProblemBody>().code).toBe('UNAUTHENTICATED');
  });
});

// ──────────────────────────────────────────────────────────────────────────────────────────────────
describe('POST /v1/auth/refresh', () => {
  it('A-20 rotates: a new pair, same family, the old token spent and linked to its successor', async () => {
    const { json: first } = await register();
    const res = await post('/v1/auth/refresh', { refreshToken: first.refreshToken });

    expect(res.statusCode).toBe(200);
    const second = res.json<AuthBody>();
    expect(Object.keys(second).sort()).toEqual([
      'accessToken',
      'expiresIn',
      'refreshToken',
      'tokenType',
      'user',
    ]);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(second.user.id).toBe(first.user.id);
    expect((await whoami(`Bearer ${second.accessToken}`)).statusCode).toBe(200);

    const [oldRow, newRow] = [
      await tokenRow(first.refreshToken),
      await tokenRow(second.refreshToken),
    ];
    expect(newRow.family_id).toBe(oldRow.family_id);
    expect(oldRow.revoked_at).not.toBeNull();
    expect(oldRow.replaced_by).toBe(newRow.id);
    expect(newRow.revoked_at).toBeNull();
  });

  it('A-21 REUSE of a rotated token revokes the whole family — including the newest token', async () => {
    const { json: first } = await register();
    const second = (
      await post('/v1/auth/refresh', { refreshToken: first.refreshToken })
    ).json<AuthBody>();
    const logsBefore = current.logLines.length;

    const replay = await post('/v1/auth/refresh', { refreshToken: first.refreshToken });
    expect(replay.statusCode).toBe(401);
    expect(replay.json<ProblemBody>()).toMatchObject({
      code: 'UNAUTHENTICATED',
      detail: 'Invalid or expired refresh token',
    });

    const family = await familyRows((await tokenRow(first.refreshToken)).family_id);
    expect(family).toHaveLength(2);
    expect(family.every((row) => row.revoked_at !== null)).toBe(true);

    const stolenSuccessor = await post('/v1/auth/refresh', { refreshToken: second.refreshToken });
    expect(stolenSuccessor.statusCode).toBe(401);

    const securityLog = current
      .logs()
      .slice(logsBefore)
      .find((l) => String(l['msg']).includes('reuse detected'));
    expect(securityLog?.['level']).toBe(40); // warn
    expect(JSON.stringify(securityLog)).not.toContain(first.refreshToken);
    expect(JSON.stringify(securityLog)).not.toContain(second.refreshToken);
  });

  it.each([
    ['unknown token', 'A'.repeat(43)],
    ['garbage of valid length', 'not-a-real-refresh-token-but-long-enough'],
  ])('A-22 %s → 401', async (_label, refreshToken) => {
    const res = await post('/v1/auth/refresh', { refreshToken });
    expect(res.statusCode).toBe(401);
    expect(res.json<ProblemBody>().code).toBe('UNAUTHENTICATED');
  });

  it('A-22b a missing or malformed refreshToken → 422', async () => {
    expect((await post('/v1/auth/refresh', {})).statusCode).toBe(422);
    expect((await post('/v1/auth/refresh', { refreshToken: 'short' })).statusCode).toBe(422);
    expect((await post('/v1/auth/refresh', { refreshToken: 12345 })).statusCode).toBe(422);
  });

  it('A-22c an expired refresh token (after 31 days) → 401', async () => {
    const { json } = await register();
    clock.advance(31 * DAY_MS);
    const res = await post('/v1/auth/refresh', { refreshToken: json.refreshToken });
    expect(res.statusCode).toBe(401);
  });

  it('A-23 the absolute lifetime is not extended by rotation', async () => {
    const { json: first } = await register();
    const familyExpiry = (await tokenRow(first.refreshToken)).family_expires_at;

    clock.advance(29 * DAY_MS);
    const rotated = await post('/v1/auth/refresh', { refreshToken: first.refreshToken });
    expect(rotated.statusCode).toBe(200);
    const newRow = await tokenRow(rotated.json<AuthBody>().refreshToken);
    expect(newRow.expires_at).toEqual(familyExpiry); // day 30, not day 59
    expect(newRow.family_expires_at).toEqual(familyExpiry);

    clock.advance(2 * DAY_MS); // day 31
    const late = await post('/v1/auth/refresh', {
      refreshToken: rotated.json<AuthBody>().refreshToken,
    });
    expect(late.statusCode).toBe(401);
  });

  it('A-24 a suspended user cannot refresh, and the family is revoked', async () => {
    const { json } = await register();
    await database.pool.query(`UPDATE users SET status = 'suspended' WHERE id = $1`, [
      json.user.id,
    ]);

    const res = await post('/v1/auth/refresh', { refreshToken: json.refreshToken });
    expect(res.statusCode).toBe(401);
    const family = await familyRows((await tokenRow(json.refreshToken)).family_id);
    expect(family.every((row) => row.revoked_at !== null)).toBe(true);
  });

  it('A-25 two simultaneous refreshes of one token → exactly one winner, and no live token survives', async () => {
    const { json } = await register();
    const [a, b] = await Promise.all([
      post('/v1/auth/refresh', { refreshToken: json.refreshToken }),
      post('/v1/auth/refresh', { refreshToken: json.refreshToken }),
    ]);

    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 401]);
    // Strict by design (no grace window): the loser looks like a replay, so the family is burned.
    const family = await familyRows((await tokenRow(json.refreshToken)).family_id);
    expect(family).toHaveLength(2);
    expect(family.filter((row) => row.revoked_at === null)).toHaveLength(0);
  });

  it('A-27 a refresh token revoked by logout → 401', async () => {
    const { json } = await register();
    await post('/v1/auth/logout', { refreshToken: json.refreshToken });
    const res = await post('/v1/auth/refresh', { refreshToken: json.refreshToken });
    expect(res.statusCode).toBe(401);
  });
});

// ──────────────────────────────────────────────────────────────────────────────────────────────────
describe('POST /v1/auth/logout', () => {
  it('A-28 returns 204 and the session can no longer be refreshed', async () => {
    const { json } = await register();
    const res = await post('/v1/auth/logout', { refreshToken: json.refreshToken });
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');

    const family = await familyRows((await tokenRow(json.refreshToken)).family_id);
    expect(family.every((row) => row.revoked_at !== null)).toBe(true);
    expect((await post('/v1/auth/refresh', { refreshToken: json.refreshToken })).statusCode).toBe(
      401,
    );
  });

  it('A-28b logging out revokes the newest token of a rotated family too', async () => {
    const { json: first } = await register();
    const second = (
      await post('/v1/auth/refresh', { refreshToken: first.refreshToken })
    ).json<AuthBody>();
    expect((await post('/v1/auth/logout', { refreshToken: second.refreshToken })).statusCode).toBe(
      204,
    );
    expect((await post('/v1/auth/refresh', { refreshToken: second.refreshToken })).statusCode).toBe(
      401,
    );
  });

  it('A-29 is idempotent and silent about unknown tokens', async () => {
    const { json } = await register();
    expect((await post('/v1/auth/logout', { refreshToken: json.refreshToken })).statusCode).toBe(
      204,
    );
    expect((await post('/v1/auth/logout', { refreshToken: json.refreshToken })).statusCode).toBe(
      204,
    );
    expect((await post('/v1/auth/logout', { refreshToken: 'Z'.repeat(43) })).statusCode).toBe(204);
  });

  it('A-30 only the given session ends; the same user’s other session keeps working', async () => {
    const { body, json: phone } = await register();
    const laptop = (
      await post('/v1/auth/login', { email: body.email, password: PASSWORD })
    ).json<AuthBody>();

    await post('/v1/auth/logout', { refreshToken: phone.refreshToken });

    expect((await post('/v1/auth/refresh', { refreshToken: phone.refreshToken })).statusCode).toBe(
      401,
    );
    expect((await post('/v1/auth/refresh', { refreshToken: laptop.refreshToken })).statusCode).toBe(
      200,
    );
  });

  it('A-31 without a body → 422', async () => {
    expect((await post('/v1/auth/logout')).statusCode).toBe(422);
    expect((await post('/v1/auth/logout', {})).statusCode).toBe(422);
  });
});

// ──────────────────────────────────────────────────────────────────────────────────────────────────
describe('secrets never leak', () => {
  it('A-32 no password, access token, refresh token or hash appears in any log line', async () => {
    const start = current.logLines.length;
    const { body, json: registered } = await register({ password: 'unmistakable passphrase 8842' });
    const login = (
      await post('/v1/auth/login', { email: body.email, password: 'unmistakable passphrase 8842' })
    ).json<AuthBody>();
    const refreshed = (
      await post('/v1/auth/refresh', { refreshToken: login.refreshToken })
    ).json<AuthBody>();
    await post('/v1/auth/refresh', { refreshToken: login.refreshToken }); // reuse → security log
    await post('/v1/auth/logout', { refreshToken: registered.refreshToken });
    await post('/v1/auth/login', { email: body.email, password: 'wrong unmistakable 1234' });

    const logged = current.logLines.slice(start).join('\n');
    expect(logged.length).toBeGreaterThan(0);
    for (const secret of [
      'unmistakable passphrase 8842',
      'wrong unmistakable 1234',
      registered.accessToken,
      registered.refreshToken,
      login.accessToken,
      login.refreshToken,
      refreshed.accessToken,
      refreshed.refreshToken,
      '$argon2id',
    ]) {
      expect(logged).not.toContain(secret);
    }
  });

  it('A-33 no response ever exposes stored hashes', async () => {
    const { body, res } = await register();
    const login = await post('/v1/auth/login', { email: body.email, password: PASSWORD });
    const refresh = await post('/v1/auth/refresh', {
      refreshToken: res.json<AuthBody>().refreshToken,
    });
    for (const response of [res, login, refresh]) {
      expect(response.body).not.toMatch(/password_hash|token_hash|argon2/i);
    }
  });
});

import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AuthMailService } from '../../src/modules/auth-users/services/auth-mail.service';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeClock } from '../support/fake-clock';
import { tokenFromMail } from '../support/in-memory-mail-sender';

const PASSWORD = 'correct horse battery staple';
const NEW_PASSWORD = 'a brand new passphrase 2030';
const START = '2030-01-01T00:00:00Z';
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const WEB = 'https://app.rento.example';

interface AuthBody {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; emailVerified: boolean };
}
interface ProblemBody {
  code: string;
  status: number;
  detail: string;
  errors?: Array<{ field: string; message: string }>;
}

let database: TestDatabase;
let current: TestApp;
let clock: FakeClock;
let counter = 0;

beforeAll(async () => {
  database = await createTestDatabase();
  clock = new FakeClock(START);
  current = await createTestApp({
    config: testConfig({ DATABASE_URL: database.url, PUBLIC_WEB_URL: WEB }),
    clock,
  });
});
afterAll(async () => {
  await current.app.close();
  await database.drop();
});
beforeEach(() => {
  clock.set(START);
  current.mail.failWith = undefined;
  current.mail.release();
});

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const uniqueEmail = (tag = 'user') => `${tag}-${(counter += 1)}-${Date.now()}@example.com`;
const drain = () => current.app.get(AuthMailService).drain();
const post = (
  url: string,
  payload?: Record<string, unknown>,
  headers: Record<string, string> = {},
) =>
  current.app.inject({ method: 'POST', url, ...(payload !== undefined && { payload }), headers });

async function register(overrides: Record<string, unknown> = {}) {
  const email = uniqueEmail();
  const res = await post('/v1/auth/register', {
    email,
    password: PASSWORD,
    name: 'Asha Rao',
    ...overrides,
  });
  expect(res.statusCode).toBe(201);
  await drain();
  return {
    email: String(overrides['email'] ?? email)
      .trim()
      .toLowerCase(),
    json: res.json<AuthBody>(),
  };
}

const forgot = (email: string) => post('/v1/auth/password/forgot', { email });
const reset = (token: string, newPassword = NEW_PASSWORD) =>
  post('/v1/auth/password/reset', { token, newPassword });
const verify = (token: string) => post('/v1/auth/email/verify', { token });
const login = (email: string, password: string) => post('/v1/auth/login', { email, password });

const verificationToken = (email: string, index = -1) =>
  tokenFromMail(current.mail.find(email, 'verify').at(index)!);
const resetToken = (email: string, index = -1) =>
  tokenFromMail(current.mail.find(email, 'reset').at(index)!);

async function requestReset(email: string) {
  const res = await forgot(email);
  expect(res.statusCode).toBe(202);
  await drain();
  return resetToken(email);
}

const userRow = (email: string) =>
  database.db.selectFrom('users').selectAll().where('email', '=', email).executeTakeFirstOrThrow();

const expectInvalidToken = (res: { statusCode: number; json: <T>() => T }) => {
  expect(res.statusCode).toBe(422);
  const body = res.json<ProblemBody>();
  expect(body.code).toBe('VALIDATION_FAILED');
  expect(body.errors?.map((e) => e.field)).toContain('token');
};

// ──────────────────────────────────────────────────────────────────────────────────────────────────
describe('email verification', () => {
  it('A-V1 registration mails a verification link; only a hash of the token is stored', async () => {
    const { email } = await register();

    const mails = current.mail.find(email, 'verify');
    expect(mails).toHaveLength(1);
    expect(mails[0]?.text).toContain(`${WEB}/verify-email?token=`);
    const token = verificationToken(email);

    const row = await database.db
      .selectFrom('auth_tokens')
      .selectAll()
      .where('token_hash', '=', sha256(token))
      .executeTakeFirstOrThrow();
    expect(row).toMatchObject({
      purpose: 'email_verification',
      email,
      used_at: null,
      revoked_at: null,
    });
    expect(row.expires_at).toEqual(new Date(new Date(START).getTime() + 24 * HOUR));
    const raw = await database.pool.query('SELECT 1 FROM auth_tokens WHERE token_hash = $1', [
      token,
    ]);
    expect(raw.rowCount).toBe(0);
  });

  it('A-V2 verifying sets the flags and is reflected at the next sign-in', async () => {
    const { email } = await register();
    const token = verificationToken(email);

    const res = await verify(token);
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');

    const user = await userRow(email);
    expect(user.email_verified_at).toEqual(new Date(START));
    const identity = await database.db
      .selectFrom('user_identities')
      .select('provider_email_verified')
      .where('user_id', '=', user.id)
      .where('provider', '=', 'password')
      .executeTakeFirstOrThrow();
    expect(identity.provider_email_verified).toBe(true);
    expect((await login(email, PASSWORD)).json<AuthBody>().user.emailVerified).toBe(true);
    const row = await database.db
      .selectFrom('auth_tokens')
      .select('used_at')
      .where('token_hash', '=', sha256(token))
      .executeTakeFirstOrThrow();
    expect(row.used_at).toEqual(new Date(START));
  });

  it('A-V3 a used, unknown, expired or malformed token is rejected as 422 on "token"', async () => {
    const { email } = await register();
    const token = verificationToken(email);
    expect((await verify(token)).statusCode).toBe(204);
    expectInvalidToken(await verify(token)); // single use

    expectInvalidToken(await verify('A'.repeat(43))); // unknown
    expect((await verify('short')).statusCode).toBe(422); // malformed
    expect((await post('/v1/auth/email/verify', {})).statusCode).toBe(422);

    const other = await register();
    clock.advance(24 * HOUR + MINUTE);
    expectInvalidToken(await verify(verificationToken(other.email))); // expired
  });

  it('A-V4 resending supersedes the previous link', async () => {
    const { email, json } = await register();
    const oldToken = verificationToken(email);

    clock.advance(61_000);
    const res = await post('/v1/auth/email/verification/resend', undefined, {
      authorization: `Bearer ${json.accessToken}`,
    });
    expect(res.statusCode).toBe(202);
    await drain();
    expect(current.mail.find(email, 'verify')).toHaveLength(2);

    expectInvalidToken(await verify(oldToken));
    expect((await verify(verificationToken(email))).statusCode).toBe(204);
  });

  it('A-V5 resend needs sign-in, honours a 60 s cooldown, and skips verified accounts', async () => {
    const { email, json } = await register();
    const auth = { authorization: `Bearer ${json.accessToken}` };

    expect((await post('/v1/auth/email/verification/resend')).statusCode).toBe(401);

    clock.advance(10_000);
    expect((await post('/v1/auth/email/verification/resend', undefined, auth)).statusCode).toBe(
      202,
    );
    await drain();
    expect(current.mail.find(email, 'verify')).toHaveLength(1); // cooldown: nothing new

    clock.advance(61_000);
    expect((await post('/v1/auth/email/verification/resend', undefined, auth)).statusCode).toBe(
      202,
    );
    await drain();
    expect(current.mail.find(email, 'verify')).toHaveLength(2);

    expect((await verify(verificationToken(email))).statusCode).toBe(204);
    clock.advance(2 * MINUTE);
    expect((await post('/v1/auth/email/verification/resend', undefined, auth)).statusCode).toBe(
      202,
    );
    await drain();
    expect(current.mail.find(email, 'verify')).toHaveLength(2); // already verified: no mail
  });

  it('A-V6 a link is dead once the account email has changed', async () => {
    const { email } = await register();
    const token = verificationToken(email);
    await database.pool.query('UPDATE users SET email = $1 WHERE email = $2', [
      uniqueEmail('moved'),
      email,
    ]);

    expectInvalidToken(await verify(token));
  });

  it('A-V7 five simultaneous verifications of one link → exactly one wins', async () => {
    const { email } = await register();
    const token = verificationToken(email);

    const results = await Promise.all(Array.from({ length: 5 }, () => verify(token)));
    expect(results.map((r) => r.statusCode).sort()).toEqual([204, 422, 422, 422, 422]);
  });

  it('A-V8 a suspended account cannot be verified through an old link', async () => {
    const { email } = await register();
    const token = verificationToken(email);
    await database.pool.query(`UPDATE users SET status = 'suspended' WHERE email = $1`, [email]);

    expectInvalidToken(await verify(token));
    expect((await userRow(email)).email_verified_at).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────────────────────────
describe('POST /v1/auth/password/forgot', () => {
  it('A-R1 answers 202 identically for every kind of address, and mails only real password accounts', async () => {
    const real = await register();
    const suspended = await register();
    await database.pool.query(`UPDATE users SET status = 'suspended' WHERE email = $1`, [
      suspended.email,
    ]);
    const socialOnly = uniqueEmail('social');
    await database.pool.query('INSERT INTO users (email) VALUES ($1)', [socialOnly]);
    const unknown = uniqueEmail('ghost');

    const responses = [];
    for (const email of [real.email, suspended.email, socialOnly, unknown]) {
      const res = await forgot(email);
      const headers = { ...res.headers };
      delete headers['date']; // varies per request by design
      delete headers['x-request-id'];
      responses.push({ status: res.statusCode, body: res.body, headers });
    }
    await drain();

    expect(responses.every((r) => r.status === 202 && r.body === '')).toBe(true);
    for (const r of responses) expect(r).toEqual(responses[0]);

    expect(current.mail.find(real.email, 'reset')).toHaveLength(1);
    for (const email of [suspended.email, socialOnly, unknown])
      expect(current.mail.to(email)).toHaveLength(
        email === suspended.email ? 1 : 0, // only the verification mail sent at registration
      );
    expect(current.mail.find(suspended.email, 'reset')).toHaveLength(0);
  });

  it('A-R1b a malformed or missing email is a 422 (it reveals nothing about accounts)', async () => {
    expect((await forgot('not-an-email')).statusCode).toBe(422);
    expect((await post('/v1/auth/password/forgot', {})).statusCode).toBe(422);
    expect(
      (await post('/v1/auth/password/forgot', { email: 'a@example.com', extra: 1 })).statusCode,
    ).toBe(422);
  });

  it('A-R2 at most one mail per minute per account', async () => {
    const { email } = await register();
    await forgot(email);
    await drain(); // background work finishes before time moves, so the cooldown is measured from the first mail
    clock.advance(20_000);
    await forgot(email);
    await drain();
    expect(current.mail.find(email, 'reset')).toHaveLength(1);

    clock.advance(61_000);
    await forgot(email);
    await drain();
    expect(current.mail.find(email, 'reset')).toHaveLength(2);
  });

  it('A-R2b matching is case- and whitespace-insensitive', async () => {
    const { email } = await register();
    await forgot(`  ${email.toUpperCase()} `);
    await drain();
    expect(current.mail.find(email, 'reset')).toHaveLength(1);
  });

  it('A-R10 the response never waits for SMTP (no timing signal about account existence)', async () => {
    const { email } = await register();
    current.mail.hang = true;

    const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 3000));
    const forgotRace = await Promise.race([forgot(email), timeout]);
    expect(forgotRace).not.toBe('timeout');
    expect((forgotRace as { statusCode: number }).statusCode).toBe(202);

    const registerRace = await Promise.race([
      post('/v1/auth/register', { email: uniqueEmail(), password: PASSWORD, name: 'Slow Mail' }),
      timeout,
    ]);
    expect(registerRace).not.toBe('timeout');
    expect((registerRace as { statusCode: number }).statusCode).toBe(201);
  });

  it('A-R11 a failing mail transport never breaks the request and is logged without secrets', async () => {
    const { email } = await register();
    current.mail.failWith = new Error('SMTP connection refused');
    const start = current.logLines.length;

    expect((await forgot(email)).statusCode).toBe(202);
    const created = await post('/v1/auth/register', {
      email: uniqueEmail('mailfail'),
      password: PASSWORD,
      name: 'Mail Fail',
    });
    expect(created.statusCode).toBe(201);
    await drain();

    const logged = current.logLines.slice(start);
    const warning = logged.find((line) => line.includes('mail delivery failed'));
    expect(warning).toBeDefined();
    expect(warning).toContain('password_reset');
    for (const line of logged) {
      expect(line).not.toContain(email);
      expect(line).not.toMatch(/token=/);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────────────────────────────
describe('POST /v1/auth/password/reset', () => {
  it('A-R3 sets the new password, ends the old one, and tells the user', async () => {
    const { email } = await register();
    const token = await requestReset(email);

    const res = await reset(token);
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
    await drain();

    expect((await login(email, NEW_PASSWORD)).statusCode).toBe(200);
    expect((await login(email, PASSWORD)).statusCode).toBe(401);
    expect(current.mail.find(email, 'changed')).toHaveLength(1);
    expect(current.mail.find(email, 'changed')[0]?.text).not.toMatch(/https?:\/\//);

    const hash = await database.db
      .selectFrom('user_identities')
      .innerJoin('users', 'users.id', 'user_identities.user_id')
      .select('user_identities.password_hash')
      .where('users.email', '=', email)
      .where('user_identities.provider', '=', 'password')
      .executeTakeFirstOrThrow();
    expect(hash.password_hash).toMatch(/^\$argon2id\$/);
  });

  it('A-R4 revokes every session of the user, on every device', async () => {
    const { email, json: phone } = await register();
    const laptop = (await login(email, PASSWORD)).json<AuthBody>();
    expect((await post('/v1/auth/refresh', { refreshToken: laptop.refreshToken })).statusCode).toBe(
      200,
    );
    const token = await requestReset(email);

    expect((await reset(token)).statusCode).toBe(204);

    const afterReset = await Promise.all([
      post('/v1/auth/refresh', { refreshToken: phone.refreshToken }),
      post('/v1/auth/refresh', { refreshToken: laptop.refreshToken }),
    ]);
    expect(afterReset.map((r) => r.statusCode)).toEqual([401, 401]);

    const live = await database.pool.query(
      'SELECT 1 FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL',
      [phone.user.id],
    );
    expect(live.rowCount).toBe(0);
  });

  it('A-R5 a used, expired, unknown or superseded link is rejected as 422 on "token"', async () => {
    const used = await register();
    const usedToken = await requestReset(used.email);
    expect((await reset(usedToken)).statusCode).toBe(204);
    expectInvalidToken(await reset(usedToken, 'yet another passphrase 99'));

    const expired = await register();
    const expiredToken = await requestReset(expired.email);
    clock.advance(61 * MINUTE);
    expectInvalidToken(await reset(expiredToken));

    expectInvalidToken(await reset('B'.repeat(43)));

    clock.set(START);
    const superseded = await register();
    const first = await requestReset(superseded.email);
    clock.advance(61_000);
    await forgot(superseded.email);
    await drain();
    const second = resetToken(superseded.email);
    expect(second).not.toBe(first);
    expectInvalidToken(await reset(first));
    expect((await reset(second)).statusCode).toBe(204);
  });

  it('A-R6 a weak new password is rejected without burning the link', async () => {
    const { email } = await register();
    const token = await requestReset(email);

    for (const weak of ['short', 'Password123', email]) {
      const res = await reset(token, weak);
      expect(res.statusCode).toBe(422);
      expect(res.json<ProblemBody>().errors?.map((e) => e.field)).toContain('newPassword');
    }
    expect((await reset(token)).statusCode).toBe(204); // the link survived the failed attempts
  });

  it('A-R7 a successful reset also proves control of the address', async () => {
    const { email } = await register();
    expect((await userRow(email)).email_verified_at).toBeNull();

    expect((await reset(await requestReset(email))).statusCode).toBe(204);

    expect((await userRow(email)).email_verified_at).toEqual(new Date(START));
  });

  it('A-R8 five simultaneous resets of one link → exactly one wins, and its password is the one that works', async () => {
    const { email } = await register();
    const token = await requestReset(email);
    const candidates = Array.from({ length: 5 }, (_, i) => `candidate passphrase number ${i} 2030`);

    const results = await Promise.all(candidates.map((password) => reset(token, password)));
    expect(results.map((r) => r.statusCode).sort()).toEqual([204, 422, 422, 422, 422]);

    const working: string[] = [];
    for (const password of candidates) {
      if ((await login(email, password)).statusCode === 200) working.push(password);
    }
    expect(working).toHaveLength(1);
  });

  it('A-R9 a link cannot be used after the account was suspended', async () => {
    const { email } = await register();
    const token = await requestReset(email);
    const before = await database.pool.query(
      `SELECT password_hash FROM user_identities i JOIN users u ON u.id = i.user_id WHERE u.email = $1`,
      [email],
    );
    await database.pool.query(`UPDATE users SET status = 'suspended' WHERE email = $1`, [email]);

    expectInvalidToken(await reset(token));
    const after = await database.pool.query(
      `SELECT password_hash FROM user_identities i JOIN users u ON u.id = i.user_id WHERE u.email = $1`,
      [email],
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it('A-R12 reset input is validated: missing fields, unknown fields', async () => {
    expect((await post('/v1/auth/password/reset', {})).statusCode).toBe(422);
    expect((await post('/v1/auth/password/reset', { token: 'A'.repeat(43) })).statusCode).toBe(422);
    expect(
      (
        await post('/v1/auth/password/reset', {
          token: 'A'.repeat(43),
          newPassword: NEW_PASSWORD,
          admin: true,
        })
      ).statusCode,
    ).toBe(422);
  });
});

// ──────────────────────────────────────────────────────────────────────────────────────────────────
describe('secrets', () => {
  it('A-S1 no token, link or password reaches any log line; the database holds hashes only', async () => {
    const start = current.logLines.length;
    const { email, json } = await register({ password: 'unmistakable passphrase 7731' });
    const verificationLink = current.mail.find(email, 'verify')[0]!.text;
    const vToken = verificationToken(email);
    await verify(vToken);
    const rToken = await requestReset(email);
    await reset(rToken, 'another unmistakable phrase 4419');
    await reset(rToken, 'another unmistakable phrase 4419'); // replay → 422
    await post('/v1/auth/refresh', { refreshToken: json.refreshToken });
    await drain();

    const logged = current.logLines.slice(start).join('\n');
    expect(logged.length).toBeGreaterThan(0);
    for (const secret of [
      vToken,
      rToken,
      '/verify-email?token=',
      '/reset-password?token=',
      'unmistakable passphrase 7731',
      'another unmistakable phrase 4419',
      verificationLink,
    ]) {
      expect(logged).not.toContain(secret);
    }

    const stored = await database.pool.query<{ token_hash: string }>(
      'SELECT token_hash FROM auth_tokens',
    );
    for (const { token_hash } of stored.rows) {
      expect(token_hash).toMatch(/^[0-9a-f]{64}$/);
      expect([vToken, rToken]).not.toContain(token_hash);
    }
  });
});

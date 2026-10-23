import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeClock } from '../support/fake-clock';
import { FakeSocialVerifier } from '../support/fake-social-verifier';
import { tokenFromMail } from '../support/in-memory-mail-sender';
import { AuthMailService } from '../../src/modules/auth-users/services/auth-mail.service';

const PASSWORD = 'correct horse battery staple';
const START = '2030-01-01T00:00:00Z';
const MINUTE = 60_000;

interface Session {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string | null };
}
interface IdentityView {
  provider: string;
  email: string | null;
  emailVerified: boolean;
  linkedAt: string;
}
interface Profile {
  id: string;
  email: string | null;
  displayName: string | null;
  phone: string | null;
  emailVerified: boolean;
  needsProfileCompletion: string[];
}
interface Problem {
  code: string;
  errors?: Array<{ field: string; message: string }>;
}

let database: TestDatabase;
let current: TestApp;
let clock: FakeClock;
let counter = 0;
const google = new FakeSocialVerifier('google');
const apple = new FakeSocialVerifier('apple');

beforeAll(async () => {
  database = await createTestDatabase();
  clock = new FakeClock(START);
  current = await createTestApp({
    config: testConfig({ DATABASE_URL: database.url }),
    clock,
    socialVerifiers: { google, apple },
  });
});
afterAll(async () => {
  await current.app.close();
  await database.drop();
});
beforeEach(() => {
  clock.set(START);
  current.logLines.length = 0;
});

const unique = (tag: string) => `${tag}-${(counter += 1)}-${Date.now()}`;
const uniqueEmail = (tag = 'user') => `${unique(tag)}@example.com`;
const bearer = (s: Session) => ({ authorization: `Bearer ${s.accessToken}` });
const call = (
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH',
  url: string,
  s?: Session,
  payload?: Record<string, unknown>,
) =>
  current.app.inject({
    method,
    url,
    ...(s && { headers: bearer(s) }),
    ...(payload !== undefined && { payload }),
  });
const list = (s: Session) => call('GET', '/v1/me/identities', s);
const link = (s: Session, idToken: string) =>
  call('POST', '/v1/me/identities/google', s, { idToken });
const unlink = (s: Session, provider: string) => call('DELETE', `/v1/me/identities/${provider}`, s);
const providersOf = async (s: Session) =>
  (await list(s)).json<IdentityView[]>().map((i) => i.provider);

async function passwordUser(): Promise<Session & { email: string }> {
  const email = uniqueEmail('pw');
  const res = await call('POST', '/v1/auth/register', undefined, {
    email,
    password: PASSWORD,
    name: 'Asha Rao',
  });
  expect(res.statusCode).toBe(201);
  return { ...res.json<Session>(), email };
}
async function googleOnlyUser(email: string | null = null): Promise<Session> {
  const token = google.grant(unique('tok'), {
    subject: unique('sub'),
    ...(email && { email, emailVerified: true }),
    name: 'Gita',
  });
  const res = await call('POST', '/v1/auth/social/google', undefined, { idToken: token });
  expect(res.statusCode).toBe(200);
  return res.json<Session>();
}
const grantGoogle = (subject = unique('sub'), email?: string) =>
  google.grant(unique('tok'), { subject, ...(email && { email, emailVerified: true }) });

describe('authentication', () => {
  it('I-1 every route needs a valid access token', async () => {
    const routes: Array<['GET' | 'POST' | 'DELETE' | 'PATCH', string, Record<string, unknown>?]> = [
      ['GET', '/v1/me/identities'],
      ['POST', '/v1/me/identities/google', { idToken: 'x' }],
      ['DELETE', '/v1/me/identities/google'],
      ['PATCH', '/v1/me', { name: 'x' }],
    ];
    for (const [method, url, payload] of routes) {
      const none = await call(method, url, undefined, payload);
      expect(none.statusCode, `${method} ${url}`).toBe(401);
      const bad = await current.app.inject({
        method,
        url,
        headers: { authorization: 'Bearer not-a-token' },
        ...(payload && { payload }),
      });
      expect(bad.statusCode, `${method} ${url}`).toBe(401);
    }
  });

  it('I-15 a suspended account is refused', async () => {
    const user = await passwordUser();
    await database.pool.query(`UPDATE users SET status = 'suspended' WHERE id = $1`, [
      user.user.id,
    ]);
    expect((await list(user)).statusCode).toBe(401);
    expect((await call('PATCH', '/v1/me', user, { name: 'Nope' })).statusCode).toBe(401);
  });
});

describe('listing', () => {
  it("I-2 shows only the caller's methods, never subjects", async () => {
    const a = await passwordUser();
    const b = await googleOnlyUser(uniqueEmail('b'));

    const resA = await list(a);
    expect(resA.statusCode).toBe(200);
    const bodyA = resA.json<IdentityView[]>();
    expect(bodyA).toHaveLength(1);
    expect(bodyA[0]).toMatchObject({ provider: 'password', email: a.email });
    expect(Object.keys(bodyA[0] as object).sort()).toEqual(
      ['email', 'emailVerified', 'linkedAt', 'provider'].sort(),
    );

    const bodyB = (await list(b)).json<IdentityView[]>();
    expect(bodyB.map((i) => i.provider)).toEqual(['google']);
    expect(JSON.stringify(bodyB)).not.toMatch(/sub-/);

    expect((await link(a, grantGoogle())).statusCode).toBe(200);
    expect(await providersOf(a)).toEqual(['password', 'google']);
    expect(await providersOf(b)).toEqual(['google']);
  });
});

describe('linking', () => {
  it('I-3 links a provider, stores its email on the identity, leaves users.email alone', async () => {
    const user = await passwordUser();
    const providerEmail = uniqueEmail('gmail');
    const res = await link(user, grantGoogle(unique('sub'), providerEmail));
    expect(res.statusCode).toBe(200);
    const identities = res.json<IdentityView[]>();
    expect(identities.map((i) => i.provider)).toEqual(['password', 'google']);
    expect(identities[1]).toMatchObject({ email: providerEmail, emailVerified: true });

    const row = await database.pool.query('SELECT email FROM users WHERE id = $1', [user.user.id]);
    expect(row.rows[0].email).toBe(user.email);
  });

  it('I-4 linking needs a recent SIGN-IN: stale ⇒ 401 REAUTH_REQUIRED before any provider call; refreshing does not help, signing in again does', async () => {
    const user = await passwordUser();
    const subject = unique('sub');
    const token = grantGoogle(subject);
    const seenBefore = google.seen.length;

    clock.advance(6 * MINUTE);
    const stale = await link(user, token);
    expect(stale.statusCode).toBe(401);
    expect(stale.json<Problem>().code).toBe('REAUTH_REQUIRED');
    expect(google.seen.length).toBe(seenBefore);

    // Other routes are not subject to the freshness rule.
    expect((await list(user)).statusCode).toBe(200);

    const refreshed = await call('POST', '/v1/auth/refresh', undefined, {
      refreshToken: user.refreshToken,
    });
    const refreshedSession = { ...user, ...refreshed.json<Session>() };
    // A refresh mints a new access token but keeps the original sign-in time, so it cannot satisfy the rule.
    const stillStale = await link(refreshedSession, token);
    expect(stillStale.statusCode).toBe(401);
    expect(stillStale.json<Problem>().code).toBe('REAUTH_REQUIRED');
    expect(google.seen.length).toBe(seenBefore);

    const again = await call('POST', '/v1/auth/login', undefined, {
      email: user.email,
      password: PASSWORD,
    });
    const signedInAgain = { ...user, ...again.json<Session>() };
    expect((await link(signedInAgain, token)).statusCode).toBe(200);
  });

  it('I-4c a social sign-in counts as a sign-in too', async () => {
    const social = await googleOnlyUser();
    clock.advance(6 * MINUTE);
    const token = apple.grant(unique('tok'), { subject: unique('sub') });
    const stale = await call('POST', '/v1/me/identities/apple', social, {
      identityToken: token,
      nonce: 'nonce-1234567890',
    });
    expect(stale.json<Problem>().code).toBe('REAUTH_REQUIRED');

    const signedIn = await call('POST', '/v1/auth/social/google', undefined, {
      idToken: google.grant(unique('tok'), { subject: unique('sub') }),
    });
    const fresh = signedIn.json<Session>();
    const ok = await call('POST', '/v1/me/identities/apple', fresh, {
      identityToken: token,
      nonce: 'nonce-1234567890',
    });
    expect(ok.statusCode).toBe(200);
  });

  it('I-4b a token just inside the window is accepted', async () => {
    const user = await passwordUser();
    clock.advance(4 * MINUTE + 50_000);
    expect((await link(user, grantGoogle())).statusCode).toBe(200);
  });

  it('I-5 a provider account owned by another user ⇒ 409 IDENTITY_IN_USE, nothing changes', async () => {
    const owner = await googleOnlyUser();
    const subject = unique('shared-sub');
    expect((await link(owner, grantGoogle(subject))).statusCode).toBe(409); // owner already has google (I-6 rule)

    const first = await passwordUser();
    expect((await link(first, grantGoogle(subject))).statusCode).toBe(200);

    const second = await passwordUser();
    const res = await link(second, grantGoogle(subject));
    expect(res.statusCode).toBe(409);
    expect(res.json<Problem>().code).toBe('IDENTITY_IN_USE');
    expect(await providersOf(second)).toEqual(['password']);
    expect(await providersOf(first)).toEqual(['password', 'google']);
  });

  it('I-6 a second account of an already-linked provider ⇒ 409 IDENTITY_IN_USE', async () => {
    const user = await passwordUser();
    expect((await link(user, grantGoogle())).statusCode).toBe(200);
    const res = await link(user, grantGoogle());
    expect(res.statusCode).toBe(409);
    expect(res.json<Problem>().code).toBe('IDENTITY_IN_USE');
    expect(await providersOf(user)).toEqual(['password', 'google']);
  });

  it('I-7 linking the identity you already have is an idempotent 200', async () => {
    const user = await passwordUser();
    const subject = unique('sub');
    expect((await link(user, grantGoogle(subject))).statusCode).toBe(200);
    expect((await link(user, grantGoogle(subject))).statusCode).toBe(200);
    expect(await providersOf(user)).toEqual(['password', 'google']);
  });

  it('I-8 a rejected token is 401 SOCIAL_TOKEN_INVALID; a disabled provider is 404', async () => {
    const user = await passwordUser();
    const bad = await link(user, 'forged');
    expect(bad.statusCode).toBe(401);
    expect(bad.json<Problem>().code).toBe('SOCIAL_TOKEN_INVALID');

    const off = await call('POST', '/v1/me/identities/facebook', user, { accessToken: 'x' });
    expect(off.statusCode).toBe(404);
  });

  it('I-8b Apple links with its own body (nonce required)', async () => {
    const user = await passwordUser();
    const token = apple.grant(unique('tok'), { subject: unique('sub') });
    const res = await call('POST', '/v1/me/identities/apple', user, {
      identityToken: token,
      nonce: 'nonce-1234567890',
    });
    expect(res.statusCode).toBe(200);
    expect(await providersOf(user)).toEqual(['password', 'apple']);
    expect(
      (await call('POST', '/v1/me/identities/apple', user, { identityToken: 'x' })).statusCode,
    ).toBe(422);
  });

  it('I-13 two users racing to link one provider account: exactly one wins', async () => {
    const [a, b] = [await passwordUser(), await passwordUser()];
    const subject = unique('race-sub');
    const results = await Promise.all([
      link(a, grantGoogle(subject)),
      link(b, grantGoogle(subject)),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const loser = results.find((r) => r.statusCode === 409);
    expect(loser?.json<Problem>().code).toBe('IDENTITY_IN_USE');
    const owners = await database.pool.query(
      'SELECT count(*)::int AS n FROM user_identities WHERE provider_subject = $1',
      [subject],
    );
    expect(owners.rows[0].n).toBe(1);
  });
});

describe('unlinking', () => {
  it('I-9 unlinks a social method; unlinking the password makes password login fail', async () => {
    const user = await passwordUser();
    await link(user, grantGoogle());
    expect((await unlink(user, 'google')).statusCode).toBe(204);
    expect(await providersOf(user)).toEqual(['password']);

    await link(user, grantGoogle());
    expect((await unlink(user, 'password')).statusCode).toBe(204);
    expect(await providersOf(user)).toEqual(['google']);
    const login = await call('POST', '/v1/auth/login', undefined, {
      email: user.email,
      password: PASSWORD,
    });
    expect(login.statusCode).toBe(401);
  });

  it('I-10 the last method cannot be removed; missing or unknown providers are 404', async () => {
    const user = await passwordUser();
    const last = await unlink(user, 'password');
    expect(last.statusCode).toBe(409);
    expect(last.json<Problem>().code).toBe('LAST_LOGIN_METHOD');
    expect(await providersOf(user)).toEqual(['password']);

    expect((await unlink(user, 'google')).statusCode).toBe(404);
    expect((await unlink(user, 'myspace')).statusCode).toBe(404);
  });

  it("I-11 one user cannot unlink another user's method", async () => {
    const victim = await passwordUser();
    await link(victim, grantGoogle());
    const attacker = await passwordUser();
    expect((await unlink(attacker, 'google')).statusCode).toBe(404);
    expect(await providersOf(victim)).toEqual(['password', 'google']);
  });

  it('I-12 parallel unlinks can never leave an account without a method', async () => {
    for (let round = 0; round < 3; round += 1) {
      const user = await passwordUser();
      await link(user, grantGoogle());
      const results = await Promise.all([unlink(user, 'password'), unlink(user, 'google')]);
      expect(results.map((r) => r.statusCode).sort()).toEqual([204, 409]);
      expect(await providersOf(user)).toHaveLength(1);
    }
  });
});

describe('PATCH /v1/me', () => {
  it('I-14a updates name and phone', async () => {
    const user = await passwordUser();
    const res = await call('PATCH', '/v1/me', user, { name: ' Asha R ', phone: '+919876543210' });
    expect(res.statusCode).toBe(200);
    expect(res.json<Profile>()).toMatchObject({
      id: user.user.id,
      displayName: 'Asha R',
      phone: '+919876543210',
      email: user.email,
      needsProfileCompletion: [],
    });
  });

  it('I-14b rejects empty bodies, bad values and unknown fields', async () => {
    const user = await passwordUser();
    for (const body of [
      {},
      { phone: '12345' },
      { phone: null },
      { name: '' },
      { name: 'x'.repeat(101) },
      { email: 'not-an-email' },
      { role: 'admin' },
      { id: 'someone-else' },
      { emailVerified: true },
    ]) {
      const res = await call('PATCH', '/v1/me', user, body);
      expect(res.statusCode, JSON.stringify(body)).toBe(422);
    }
  });

  it('I-14c completing the email: only the mailed link sets it (and verifies it)', async () => {
    const social = await googleOnlyUser();
    const email = uniqueEmail('completed');
    const res = await call('PATCH', '/v1/me', social, { email: email.toUpperCase() });
    expect(res.statusCode).toBe(200);
    // Only claimed so far: never trusted, never written, until the link is used.
    expect(res.json<Profile>()).toMatchObject({
      email: null,
      emailVerified: false,
      needsProfileCompletion: ['email'],
    });
    const before = await database.pool.query('SELECT email FROM users WHERE id = $1', [
      social.user.id,
    ]);
    expect(before.rows[0].email).toBeNull();

    await current.app.get(AuthMailService).drain();
    const mails = current.mail.find(email, 'verify');
    expect(mails).toHaveLength(1);
    const verify = await call('POST', '/v1/auth/email/verify', undefined, {
      token: tokenFromMail(mails[0]!),
    });
    expect(verify.statusCode).toBe(204);
    const row = await database.pool.query(
      'SELECT email, email_verified_at FROM users WHERE id = $1',
      [social.user.id],
    );
    expect(row.rows[0].email).toBe(email);
    expect(row.rows[0].email_verified_at).not.toBeNull();

    const after = await call('PATCH', '/v1/me', social, { name: 'Gita R' });
    expect(after.json<Profile>()).toMatchObject({
      email,
      emailVerified: true,
      needsProfileCompletion: [],
    });
  });

  it('I-14d an existing email cannot be changed here; a taken email is a 409', async () => {
    const user = await passwordUser();
    const change = await call('PATCH', '/v1/me', user, { email: uniqueEmail('new') });
    expect(change.statusCode).toBe(422);
    expect(change.json<Problem>().errors?.map((e) => e.field)).toContain('email');

    const social = await googleOnlyUser();
    const taken = await call('PATCH', '/v1/me', social, { email: user.email });
    expect(taken.statusCode).toBe(409);
    expect(taken.json<Problem>().code).toBe('EMAIL_TAKEN');
    const row = await database.pool.query('SELECT email FROM users WHERE id = $1', [
      social.user.id,
    ]);
    expect(row.rows[0].email).toBeNull();
  });

  it('I-14e a claimed-but-unverified address does not block its real owner and cannot be taken over', async () => {
    const social = await googleOnlyUser();
    const email = uniqueEmail('mine');
    await call('PATCH', '/v1/me', social, { email });
    await current.app.get(AuthMailService).drain();
    const claimToken = tokenFromMail(current.mail.find(email, 'verify')[0]!);

    const owner = await call('POST', '/v1/auth/register', undefined, {
      email,
      password: PASSWORD,
      name: 'Real Owner',
    });
    expect(owner.statusCode).toBe(201); // the claim reserved nothing

    const late = await call('POST', '/v1/auth/email/verify', undefined, { token: claimToken });
    expect([409, 422]).toContain(late.statusCode); // the claimant can no longer take it
    const row = await database.pool.query('SELECT email FROM users WHERE id = $1', [
      social.user.id,
    ]);
    expect(row.rows[0].email).toBeNull();
  });
});

describe('hygiene', () => {
  it('I-16 no provider token, subject or email reaches the logs', async () => {
    const user = await passwordUser();
    const subject = unique('log-subject');
    const email = uniqueEmail('logs');
    const token = grantGoogle(subject, email);
    await link(user, token);
    await link(user, 'forged-token-value');
    const logs = current.logLines.join('\n');
    for (const needle of [token, subject, email, 'forged-token-value']) {
      expect(logs).not.toContain(needle);
    }
  });
});

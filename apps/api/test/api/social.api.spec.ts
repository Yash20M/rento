import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { UserRepository } from '../../src/modules/auth-users/data/user.repository';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeSocialVerifier } from '../support/fake-social-verifier';

const PASSWORD = 'correct horse battery staple';

interface SocialBody {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  user: { id: string; email: string | null; displayName: string | null; emailVerified: boolean };
  needsProfileCompletion: string[];
}
interface ProblemBody {
  code: string;
  status: number;
  detail: string;
  errors?: Array<{ field: string; message: string }>;
}

let database: TestDatabase;
let current: TestApp;
let counter = 0;
const google = new FakeSocialVerifier('google');
const apple = new FakeSocialVerifier('apple');
// facebook is deliberately NOT enabled: an unavailable provider must answer 404

beforeAll(async () => {
  database = await createTestDatabase();
  current = await createTestApp({
    config: testConfig({ DATABASE_URL: database.url }),
    socialVerifiers: { google, apple },
  });
});
afterAll(async () => {
  await current.app.close();
  await database.drop();
});
beforeEach(() => {
  current.logLines.length = 0;
});

const unique = (tag: string) => `${tag}-${(counter += 1)}-${Date.now()}`;
const uniqueEmail = (tag = 'user') => `${unique(tag)}@example.com`;
const post = (url: string, payload?: Record<string, unknown>) =>
  current.app.inject({ method: 'POST', url, ...(payload !== undefined && { payload }) });
const signInGoogle = (idToken: string) => post('/v1/auth/social/google', { idToken });

/** Registers a password user; optionally marks the address verified (as the emailed link would). */
async function passwordUser(verified: boolean) {
  const email = uniqueEmail('pw');
  const res = await post('/v1/auth/register', { email, password: PASSWORD, name: 'Asha Rao' });
  expect(res.statusCode).toBe(201);
  const id = res.json<SocialBody>().user.id;
  if (verified) {
    await database.pool.query('UPDATE users SET email_verified_at = now() WHERE id = $1', [id]);
  }
  return { id, email };
}

const identitiesOf = (userId: string) =>
  database.db
    .selectFrom('user_identities')
    .selectAll()
    .where('user_id', '=', userId)
    .orderBy('provider')
    .execute();
const countRows = async (table: 'users' | 'user_identities', where: string, value: string) =>
  Number(
    (
      await database.pool.query(`SELECT count(*)::int AS n FROM ${table} WHERE ${where} = $1`, [
        value,
      ])
    ).rows[0].n,
  );

describe('POST /v1/auth/social/{provider} — resolution', () => {
  it('S-1 a new Google user is created with a verified email and a working session', async () => {
    const email = uniqueEmail('g');
    const subject = unique('sub');
    const token = google.grant(unique('tok'), {
      subject,
      email,
      emailVerified: true,
      name: 'Gita Rao',
    });

    const res = await signInGoogle(token);
    expect(res.statusCode).toBe(200);
    const body = res.json<SocialBody>();
    expect(body).toMatchObject({
      tokenType: 'Bearer',
      needsProfileCompletion: [],
      user: { email, displayName: 'Gita Rao', emailVerified: true },
    });

    const [identity, ...rest] = await identitiesOf(body.user.id);
    expect(rest).toHaveLength(0);
    expect(identity).toMatchObject({
      provider: 'google',
      provider_subject: subject,
      provider_email_verified: true,
      password_hash: null,
    });

    const refreshed = await post('/v1/auth/refresh', { refreshToken: body.refreshToken });
    expect(refreshed.statusCode).toBe(200);
    const whoami = await current.app.inject({
      method: 'GET',
      url: '/v1/__test/whoami',
      headers: { authorization: `Bearer ${body.accessToken}` },
    });
    expect(whoami.json<{ sub: string }>().sub).toBe(body.user.id);
  });

  it('S-2 a returning identity signs in to the same user and nothing is rewritten', async () => {
    const subject = unique('sub');
    const first = google.grant(unique('tok'), {
      subject,
      email: uniqueEmail('g'),
      emailVerified: true,
      name: 'Gita Rao',
    });
    const a = (await signInGoogle(first)).json<SocialBody>();

    const changed = google.grant(unique('tok'), {
      subject,
      email: uniqueEmail('changed'),
      emailVerified: true,
      name: 'New Name',
    });
    const res = await signInGoogle(changed);
    expect(res.statusCode).toBe(200);
    const b = res.json<SocialBody>();

    expect(b.user.id).toBe(a.user.id);
    expect(b.user.email).toBe(a.user.email);
    expect(b.user.displayName).toBe('Gita Rao');
    expect(await countRows('user_identities', 'provider_subject', subject)).toBe(1);
  });

  it('S-3 a verified provider email links to the matching verified user', async () => {
    const existing = await passwordUser(true);
    const token = google.grant(unique('tok'), {
      subject: unique('sub'),
      email: existing.email,
      emailVerified: true,
    });

    const res = await signInGoogle(token);
    expect(res.statusCode).toBe(200);
    expect(res.json<SocialBody>().user.id).toBe(existing.id);
    expect((await identitiesOf(existing.id)).map((i) => i.provider)).toEqual([
      'google',
      'password',
    ]);

    const login = await post('/v1/auth/login', { email: existing.email, password: PASSWORD });
    expect(login.statusCode).toBe(200); // the password still works
  });

  it('S-4 an UNVERIFIED provider email never links: 409 and nothing is written', async () => {
    const existing = await passwordUser(true);
    const subject = unique('sub');
    const token = google.grant(unique('tok'), {
      subject,
      email: existing.email,
      emailVerified: false,
    });

    const res = await signInGoogle(token);
    expect(res.statusCode).toBe(409);
    expect(res.json<ProblemBody>().code).toBe('ACCOUNT_LINK_REQUIRED');
    expect(await countRows('user_identities', 'provider_subject', subject)).toBe(0);
    expect((await identitiesOf(existing.id)).map((i) => i.provider)).toEqual(['password']);
  });

  it('S-5 an unverified provider email with no match creates an account WITHOUT that email', async () => {
    const claimed = uniqueEmail('claimed');
    const subject = unique('sub');
    const token = google.grant(unique('tok'), {
      subject,
      email: claimed,
      emailVerified: false,
      name: 'Hari',
    });

    const res = await signInGoogle(token);
    expect(res.statusCode).toBe(200);
    const body = res.json<SocialBody>();
    expect(body.user).toMatchObject({ email: null, emailVerified: false, displayName: 'Hari' });
    expect(body.needsProfileCompletion).toEqual(['email']);

    const [identity] = await identitiesOf(body.user.id);
    expect(identity).toMatchObject({ provider_email: claimed, provider_email_verified: false });
    expect(await countRows('users', 'email', claimed)).toBe(0);
  });

  it('S-6 an unverified claim cannot squat an address: the real owner can still register', async () => {
    const victim = uniqueEmail('victim');
    const token = google.grant(unique('tok'), {
      subject: unique('sub'),
      email: victim,
      emailVerified: false,
    });
    expect((await signInGoogle(token)).statusCode).toBe(200);

    const res = await post('/v1/auth/register', {
      email: victim,
      password: PASSWORD,
      name: 'Real Owner',
    });
    expect(res.statusCode).toBe(201);
  });

  it('S-7 a verified provider email never links to a user whose own email is unverified', async () => {
    const existing = await passwordUser(false);
    const subject = unique('sub');
    const token = google.grant(unique('tok'), {
      subject,
      email: existing.email,
      emailVerified: true,
    });

    const res = await signInGoogle(token);
    expect(res.statusCode).toBe(409);
    expect(res.json<ProblemBody>().code).toBe('ACCOUNT_LINK_REQUIRED');
    expect(await countRows('user_identities', 'provider_subject', subject)).toBe(0);
  });

  it('S-8 a provider that returns no email still signs in and asks for one', async () => {
    const token = google.grant(unique('tok'), { subject: unique('sub'), name: 'No Mail' });

    const res = await signInGoogle(token);
    expect(res.statusCode).toBe(200);
    const body = res.json<SocialBody>();
    expect(body.user.email).toBeNull();
    expect(body.needsProfileCompletion).toEqual(['email']);
  });

  it('S-9 a second subject of a provider the user already uses is a 409, not a silent merge', async () => {
    const existing = await passwordUser(true);
    const first = google.grant(unique('tok'), {
      subject: unique('sub'),
      email: existing.email,
      emailVerified: true,
    });
    expect((await signInGoogle(first)).statusCode).toBe(200);

    const other = google.grant(unique('tok'), {
      subject: unique('sub'),
      email: existing.email,
      emailVerified: true,
    });
    const res = await signInGoogle(other);
    expect(res.statusCode).toBe(409);
    expect(res.json<ProblemBody>().code).toBe('ACCOUNT_LINK_REQUIRED');
    expect((await identitiesOf(existing.id)).filter((i) => i.provider === 'google')).toHaveLength(
      1,
    );
  });

  it('S-10 simultaneous first sign-ins create exactly one user and identity', async () => {
    const subject = unique('sub');
    const email = uniqueEmail('race');
    const token = google.grant(unique('tok'), { subject, email, emailVerified: true });

    const results = await Promise.all(Array.from({ length: 8 }, () => signInGoogle(token)));
    expect(results.map((r) => r.statusCode)).toEqual(Array(8).fill(200));
    const ids = new Set(results.map((r) => r.json<SocialBody>().user.id));
    expect(ids.size).toBe(1);
    expect(await countRows('user_identities', 'provider_subject', subject)).toBe(1);
    expect(await countRows('users', 'email', email)).toBe(1);
  });

  it('S-10b simultaneous first sign-ins that link to a password user create one identity (repeated: it is a race)', async () => {
    for (let round = 0; round < 10; round += 1) {
      const existing = await passwordUser(true);
      const subject = unique('sub');
      const token = google.grant(unique('tok'), {
        subject,
        email: existing.email,
        emailVerified: true,
      });

      const results = await Promise.all(Array.from({ length: 8 }, () => signInGoogle(token)));
      expect(results.map((r) => r.statusCode)).toEqual(Array(8).fill(200));
      expect(new Set(results.map((r) => r.json<SocialBody>().user.id))).toEqual(
        new Set([existing.id]),
      );
      expect(await countRows('user_identities', 'provider_subject', subject)).toBe(1);
    }
  });

  it('S-10d the same race, forced deterministically: the identity is committed between the two reads', async () => {
    const existing = await passwordUser(true);
    const subject = unique('sub');
    const token = google.grant(unique('tok'), {
      subject,
      email: existing.email,
      emailVerified: true,
    });

    const users = current.app.get(UserRepository);
    const original = users.findByIdentity.bind(users);
    let injected = false;
    users.findByIdentity = async (...args) => {
      const found = await original(...args);
      if (!injected && !found) {
        injected = true; // a concurrent sign-in commits the very same identity right after our read
        await database.pool.query(
          "INSERT INTO user_identities (user_id, provider, provider_subject, provider_email, provider_email_verified) VALUES ($1, 'google', $2, $3, true)",
          [existing.id, subject, existing.email],
        );
      }
      return found;
    };
    try {
      const res = await signInGoogle(token);
      expect(res.statusCode).toBe(200);
      expect(res.json<SocialBody>().user.id).toBe(existing.id);
    } finally {
      users.findByIdentity = original;
    }
    expect(injected).toBe(true);
    expect(await countRows('user_identities', 'provider_subject', subject)).toBe(1);
  });

  it('S-10c a social sign-up racing a password registration of the same address never 500s', async () => {
    const email = uniqueEmail('mix');
    const token = google.grant(unique('tok'), {
      subject: unique('sub'),
      email,
      emailVerified: true,
    });

    const [social, register] = await Promise.all([
      signInGoogle(token),
      post('/v1/auth/register', { email, password: PASSWORD, name: 'Racer' }),
    ]);
    expect([200, 409]).toContain(social.statusCode);
    expect([201, 409]).toContain(register.statusCode);
    expect(await countRows('users', 'email', email)).toBe(1);
  });
});

describe('POST /v1/auth/social/{provider} — rejection', () => {
  it('S-11 a token the verifier rejects is 401 SOCIAL_TOKEN_INVALID', async () => {
    const res = await signInGoogle('forged-or-expired-token');
    expect(res.statusCode).toBe(401);
    const body = res.json<ProblemBody>();
    expect(body.code).toBe('SOCIAL_TOKEN_INVALID');
    expect(JSON.stringify(body)).not.toContain('forged-or-expired-token');
  });

  it('S-12 a provider without a verifier is unavailable (404), and its verifier is never asked', async () => {
    const res = await post('/v1/auth/social/facebook', { accessToken: 'whatever' });
    expect(res.statusCode).toBe(404);
    expect(res.json<ProblemBody>().code).toBe('NOT_FOUND');
  });

  it('S-13 suspended users cannot sign in socially, by identity or by matching email', async () => {
    const subject = unique('sub');
    const email = uniqueEmail('susp');
    const token = google.grant(unique('tok'), { subject, email, emailVerified: true });
    const userId = (await signInGoogle(token)).json<SocialBody>().user.id;
    await database.pool.query(`UPDATE users SET status = 'suspended' WHERE id = $1`, [userId]);

    const again = await signInGoogle(token);
    expect(again.statusCode).toBe(401);
    expect(again.json<ProblemBody>().code).toBe('UNAUTHENTICATED');

    const other = google.grant(unique('tok'), {
      subject: unique('sub'),
      email,
      emailVerified: true,
    });
    const viaEmail = await signInGoogle(other);
    expect(viaEmail.statusCode).toBe(401);
    expect(viaEmail.json<ProblemBody>().code).toBe('UNAUTHENTICATED');
  });

  it('S-14 no token, email or subject reaches any log line', async () => {
    const secretToken = `secret-${unique('tok')}`;
    const subject = `subject-${unique('sub')}`;
    const email = uniqueEmail('logs');
    google.grant(secretToken, { subject, email, emailVerified: true });
    await signInGoogle(secretToken);
    await signInGoogle(`bad-${secretToken}`);

    const logs = current.logLines.join('\n');
    for (const needle of [secretToken, subject, email]) expect(logs).not.toContain(needle);
  });

  it('S-15 malformed bodies are 422', async () => {
    expect((await post('/v1/auth/social/google', {})).statusCode).toBe(422);
    expect((await post('/v1/auth/social/google', { idToken: '' })).statusCode).toBe(422);
    expect((await post('/v1/auth/social/google', { idToken: 'x', extra: 1 })).statusCode).toBe(422);
    expect((await post('/v1/auth/social/apple', { identityToken: 'x' })).statusCode).toBe(422);
    // Facebook: exactly one mode (validated before availability is considered)
    expect((await post('/v1/auth/social/facebook', {})).statusCode).toBe(422);
    expect(
      (
        await post('/v1/auth/social/facebook', {
          accessToken: 'a',
          authenticationToken: 'b',
          nonce: 'n',
        })
      ).statusCode,
    ).toBe(422);
    expect((await post('/v1/auth/social/facebook', { authenticationToken: 'b' })).statusCode).toBe(
      422,
    );
  });

  it('S-16 Apple: the name from the request is used on first sign-in only', async () => {
    const subject = unique('sub');
    const token = apple.grant(unique('tok'), {
      subject,
      email: `${unique('relay')}@privaterelay.appleid.com`,
      emailVerified: true,
    });
    const nonce = 'nonce-1234567890';

    const first = await post('/v1/auth/social/apple', {
      identityToken: token,
      nonce,
      fullName: '  Anil Kumar ',
    });
    expect(first.statusCode).toBe(200);
    expect(first.json<SocialBody>().user.displayName).toBe('Anil Kumar');

    const second = await post('/v1/auth/social/apple', {
      identityToken: token,
      nonce,
      fullName: 'Someone Else',
    });
    expect(second.json<SocialBody>().user.displayName).toBe('Anil Kumar');
    expect(apple.seen.at(-1)).toMatchObject({ provider: 'apple', nonce });
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeJwksServer } from '../support/fake-jwks-server';

// Google sign-in wired exactly as in production (config → verifier → endpoint), with only Google's key endpoint
// replaced by a local server that signs real RS256 tokens.

const CLIENT = '1111-web.apps.googleusercontent.com';

interface Body {
  accessToken: string;
  user: { id: string; email: string | null; emailVerified: boolean };
  needsProfileCompletion: string[];
}
interface Problem {
  code: string;
  detail: string;
}

let database: TestDatabase;
let jwks: FakeJwksServer;
let enabled: TestApp;
let disabled: TestApp;
let counter = 0;

beforeAll(async () => {
  jwks = await FakeJwksServer.start();
  database = await createTestDatabase();
  enabled = await createTestApp({
    config: testConfig({
      DATABASE_URL: database.url,
      GOOGLE_CLIENT_IDS: `${CLIENT}, other-client`,
      GOOGLE_JWKS_URL: jwks.url,
    }),
  });
  disabled = await createTestApp({ config: testConfig({ DATABASE_URL: database.url }) });
});
afterAll(async () => {
  await enabled.app.close();
  await disabled.app.close();
  await database.drop();
  await jwks.stop();
});

const nowSec = () => Math.floor(Date.now() / 1000);
const claims = (overrides: Record<string, unknown> = {}) => {
  counter += 1;
  return {
    iss: 'https://accounts.google.com',
    aud: CLIENT,
    sub: `google-sub-${counter}-${Date.now()}`,
    email: `gita-${counter}-${Date.now()}@example.com`,
    email_verified: true,
    name: 'Gita Rao',
    iat: nowSec(),
    exp: nowSec() + 3600,
    ...overrides,
  };
};
const signIn = (app: TestApp, idToken: string) =>
  app.app.inject({ method: 'POST', url: '/v1/auth/social/google', payload: { idToken } });

describe('POST /v1/auth/social/google with the real verifier', () => {
  it('G-20a a genuine token creates a user, and signing in again returns the same one', async () => {
    const own = claims();
    const first = await signIn(enabled, await jwks.sign(own));
    expect(first.statusCode).toBe(200);
    const body = first.json<Body>();
    expect(body.user).toMatchObject({ email: own.email, emailVerified: true });
    expect(body.needsProfileCompletion).toEqual([]);

    const again = await signIn(enabled, await jwks.sign({ ...own, iat: nowSec() + 0 }));
    expect(again.json<Body>().user.id).toBe(body.user.id);

    const row = await database.pool.query(
      `SELECT provider_subject FROM user_identities WHERE user_id = $1 AND provider = 'google'`,
      [body.user.id],
    );
    expect(row.rows).toEqual([{ provider_subject: own.sub }]);
  });

  it('G-20b the second configured client ID is accepted as well', async () => {
    const res = await signIn(enabled, await jwks.sign(claims({ aud: 'other-client' })));
    expect(res.statusCode).toBe(200);
  });

  it.each([
    ['wrong audience', () => claims({ aud: 'someone-elses-app' })],
    ['wrong issuer', () => claims({ iss: 'https://evil.example' })],
    ['expired', () => claims({ iat: nowSec() - 7200, exp: nowSec() - 3600 })],
  ])('G-20c %s ⇒ 401 SOCIAL_TOKEN_INVALID and no account', async (_name, make) => {
    const bad = make();
    const res = await signIn(enabled, await jwks.sign(bad));
    expect(res.statusCode).toBe(401);
    expect(res.json<Problem>().code).toBe('SOCIAL_TOKEN_INVALID');
    const users = await database.pool.query(
      'SELECT 1 FROM user_identities WHERE provider_subject = $1',
      [bad.sub],
    );
    expect(users.rowCount).toBe(0);
  });

  it('G-20d forged tokens (alg=none, unpublished key, public-key HMAC) ⇒ 401', async () => {
    const forged = [
      jwks.unsigned(claims()),
      await jwks.sign(claims(), { signWith: await jwks.unpublishedKey() }),
      await jwks.hmacWithPublicKey(claims()),
    ];
    for (const token of forged) {
      const res = await signIn(enabled, token);
      expect(res.statusCode).toBe(401);
      expect(res.json<Problem>().code).toBe('SOCIAL_TOKEN_INVALID');
    }
  });

  it('G-20e an unverified Google email never links to an existing account (P2-03 policy holds end to end)', async () => {
    const email = `owner-${Date.now()}@example.com`;
    const register = await enabled.app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email, password: 'correct horse battery staple', name: 'Owner' },
    });
    expect(register.statusCode).toBe(201);

    const res = await signIn(enabled, await jwks.sign(claims({ email, email_verified: false })));
    expect(res.statusCode).toBe(409);
    expect(res.json<Problem>().code).toBe('ACCOUNT_LINK_REQUIRED');
  });

  it('G-20f key rotation: a token signed with a newly published key works without a restart', async () => {
    await jwks.addKey('rotated-key');
    const res = await signIn(enabled, await jwks.sign(claims(), { kid: 'rotated-key' }));
    expect(res.statusCode).toBe(200);
  });

  it('G-21a without GOOGLE_CLIENT_IDS the Google endpoint is unavailable (404)', async () => {
    const res = await signIn(disabled, await jwks.sign(claims()));
    expect(res.statusCode).toBe(404);
    expect(res.json<Problem>().code).toBe('NOT_FOUND');
  });

  it('G-21b no token, email or subject reaches the logs, even on rejection', async () => {
    const good = claims();
    const goodToken = await jwks.sign(good);
    const badToken = await jwks.sign(claims({ aud: 'nope' }));
    await signIn(enabled, goodToken);
    await signIn(enabled, badToken);

    const logs = enabled.logLines.join('\n');
    for (const needle of [goodToken, badToken, good.email, good.sub]) {
      expect(logs).not.toContain(needle);
    }
  });
});

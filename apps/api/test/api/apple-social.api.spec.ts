import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeJwksServer } from '../support/fake-jwks-server';

// Apple sign-in wired as in production (config → verifier → endpoint); only Apple's key endpoint is a local fake.

const BUNDLE = 'com.rento.app';
const NONCE = 'raw-nonce-abcdef-123456';

interface Body {
  user: { id: string; email: string | null; displayName: string | null; emailVerified: boolean };
  needsProfileCompletion: string[];
}
interface Problem {
  code: string;
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
      APPLE_CLIENT_IDS: BUNDLE,
      APPLE_JWKS_URL: jwks.url,
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

const unique = (tag: string) => `${tag}-${(counter += 1)}-${Date.now()}`;
const nowSec = () => Math.floor(Date.now() / 1000);
const claims = (overrides: Record<string, unknown> = {}) => ({
  iss: 'https://appleid.apple.com',
  aud: BUNDLE,
  sub: unique('apple-sub'),
  nonce: NONCE,
  email: `${unique('relay')}@privaterelay.appleid.com`,
  email_verified: 'true',
  is_private_email: 'true',
  iat: nowSec(),
  exp: nowSec() + 3600,
  ...overrides,
});
const signIn = (app: TestApp, identityToken: string, extra: Record<string, unknown> = {}) =>
  app.app.inject({
    method: 'POST',
    url: '/v1/auth/social/apple',
    payload: { identityToken, nonce: NONCE, ...extra },
  });

describe('POST /v1/auth/social/apple with the real verifier', () => {
  it('P-1 a private-relay email is stored as the verified account email', async () => {
    const own = claims();
    const res = await signIn(enabled, await jwks.sign(own));
    expect(res.statusCode).toBe(200);
    const body = res.json<Body>();
    expect(body.user).toMatchObject({ email: own.email, emailVerified: true });
    expect(body.needsProfileCompletion).toEqual([]);

    const again = await signIn(enabled, await jwks.sign({ ...own, iat: nowSec() }));
    expect(again.json<Body>().user.id).toBe(body.user.id);
  });

  it('P-2 the name sent with the first sign-in is stored once and never overwritten', async () => {
    const own = claims();
    const first = await signIn(enabled, await jwks.sign(own), { fullName: 'Anil Kumar' });
    expect(first.json<Body>().user.displayName).toBe('Anil Kumar');
    const second = await signIn(enabled, await jwks.sign(own), { fullName: 'Someone Else' });
    expect(second.json<Body>().user.displayName).toBe('Anil Kumar');
  });

  it('P-3 a verified Apple email links to a verified account and 409s for an unverified one', async () => {
    const verifiedEmail = `${unique('verified')}@example.com`;
    const verified = await enabled.app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: verifiedEmail, password: 'correct horse battery staple', name: 'V' },
    });
    await database.pool.query('UPDATE users SET email_verified_at = now() WHERE id = $1', [
      verified.json<Body>().user.id,
    ]);
    const linked = await signIn(
      enabled,
      await jwks.sign(claims({ email: verifiedEmail, is_private_email: 'false' })),
    );
    expect(linked.statusCode).toBe(200);
    expect(linked.json<Body>().user.id).toBe(verified.json<Body>().user.id);

    const unverifiedEmail = `${unique('unverified')}@example.com`;
    await enabled.app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: unverifiedEmail, password: 'correct horse battery staple', name: 'U' },
    });
    const refused = await signIn(enabled, await jwks.sign(claims({ email: unverifiedEmail })));
    expect(refused.statusCode).toBe(409);
    expect(refused.json<Problem>().code).toBe('ACCOUNT_LINK_REQUIRED');
  });

  it('P-4 wrong nonce / audience / expired / forged ⇒ 401 SOCIAL_TOKEN_INVALID', async () => {
    const cases = [
      await jwks.sign(claims({ nonce: 'different' })),
      await jwks.sign(claims({ aud: 'com.someone.else' })),
      await jwks.sign(claims({ exp: nowSec() - 3600 })),
      jwks.unsigned(claims()),
      await jwks.hmacWithPublicKey(claims()),
    ];
    for (const token of cases) {
      const res = await signIn(enabled, token);
      expect(res.statusCode).toBe(401);
      expect(res.json<Problem>().code).toBe('SOCIAL_TOKEN_INVALID');
    }
  });

  it('P-5 without APPLE_CLIENT_IDS the endpoint is unavailable (404)', async () => {
    const res = await signIn(disabled, await jwks.sign(claims()));
    expect(res.statusCode).toBe(404);
  });

  it('P-6 no token, nonce, email or subject reaches the logs', async () => {
    const own = claims();
    const token = await jwks.sign(own);
    const bad = await jwks.sign(claims({ aud: 'nope' }));
    await signIn(enabled, token, { fullName: 'Log Check Person' });
    await signIn(enabled, bad);
    const logs = enabled.logLines.join('\n');
    for (const needle of [token, bad, own.email, own.sub, NONCE, 'Log Check Person']) {
      expect(logs).not.toContain(needle);
    }
  });
});

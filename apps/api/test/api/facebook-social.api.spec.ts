import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeGraphServer } from '../support/fake-graph-server';
import { FakeJwksServer } from '../support/fake-jwks-server';

// Facebook sign-in wired as in production (config → verifier → endpoint); only Meta's servers are local fakes.

const APP_ID = 'app-123';
const NONCE = 'nonce-abcdef-123456';

interface Body {
  user: { id: string; email: string | null; emailVerified: boolean };
  needsProfileCompletion: string[];
}
interface Problem {
  code: string;
}

let database: TestDatabase;
let graph: FakeGraphServer;
let jwks: FakeJwksServer;
let enabled: TestApp;
let disabled: TestApp;
let counter = 0;

beforeAll(async () => {
  graph = await FakeGraphServer.start();
  jwks = await FakeJwksServer.start();
  database = await createTestDatabase();
  enabled = await createTestApp({
    config: testConfig({
      DATABASE_URL: database.url,
      FACEBOOK_APP_ID: APP_ID,
      FACEBOOK_APP_SECRET: 'api-test-app-secret',
      FACEBOOK_GRAPH_URL: graph.url,
      FACEBOOK_JWKS_URL: jwks.url,
    }),
  });
  disabled = await createTestApp({ config: testConfig({ DATABASE_URL: database.url }) });
});
afterAll(async () => {
  await enabled.app.close();
  await disabled.app.close();
  await database.drop();
  await graph.stop();
  await jwks.stop();
});
beforeEach(() => {
  graph.reset();
  enabled.logLines.length = 0;
});

const unique = (tag: string) => `${tag}-${(counter += 1)}-${Date.now()}`;
const classic = (app: TestApp, accessToken = 'EAAB-token') =>
  app.app.inject({ method: 'POST', url: '/v1/auth/social/facebook', payload: { accessToken } });
const limited = (authenticationToken: string, nonce = NONCE) =>
  enabled.app.inject({
    method: 'POST',
    url: '/v1/auth/social/facebook',
    payload: { authenticationToken, nonce },
  });
const nowSec = () => Math.floor(Date.now() / 1000);
const oidc = (overrides: Record<string, unknown> = {}) => ({
  iss: 'https://www.facebook.com',
  aud: APP_ID,
  sub: unique('limited-sub'),
  nonce: NONCE,
  name: 'Farah Khan',
  iat: nowSec(),
  exp: nowSec() + 3600,
  ...overrides,
});

describe('POST /v1/auth/social/facebook with the real verifier', () => {
  it('F-1a Classic Login: account created WITHOUT the (unverified) Facebook email', async () => {
    const fbId = unique('fb');
    const email = `${unique('farah')}@example.com`;
    graph.debug = FakeGraphServer.validDebug({ user_id: fbId });
    graph.me = FakeGraphServer.validMe({ id: fbId, email });

    const res = await classic(enabled);
    expect(res.statusCode).toBe(200);
    const body = res.json<Body>();
    expect(body.user).toMatchObject({ email: null, emailVerified: false });
    expect(body.needsProfileCompletion).toEqual(['email']);

    const identity = await database.pool.query(
      'SELECT provider_subject, provider_email, provider_email_verified FROM user_identities WHERE user_id = $1',
      [body.user.id],
    );
    expect(identity.rows).toEqual([
      { provider_subject: fbId, provider_email: email, provider_email_verified: false },
    ]);

    graph.debug = FakeGraphServer.validDebug({ user_id: fbId });
    const again = await classic(enabled);
    expect(again.json<Body>().user.id).toBe(body.user.id);
  });

  it('F-1b Limited Login works end to end and follows the same policy', async () => {
    const claims = oidc({ email: `${unique('ltd')}@example.com` });
    const res = await limited(await jwks.sign(claims));
    expect(res.statusCode).toBe(200);
    expect(res.json<Body>()).toMatchObject({
      user: { email: null, emailVerified: false },
      needsProfileCompletion: ['email'],
    });
  });

  it('F-2 a Facebook email equal to a verified password account NEVER links (409)', async () => {
    const email = `${unique('owner')}@example.com`;
    const registered = await enabled.app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email, password: 'correct horse battery staple', name: 'Owner' },
    });
    await database.pool.query('UPDATE users SET email_verified_at = now() WHERE id = $1', [
      registered.json<Body>().user.id,
    ]);

    const fbId = unique('fb');
    graph.debug = FakeGraphServer.validDebug({ user_id: fbId });
    graph.me = FakeGraphServer.validMe({ id: fbId, email });
    const res = await classic(enabled);
    expect(res.statusCode).toBe(409);
    expect(res.json<Problem>().code).toBe('ACCOUNT_LINK_REQUIRED');

    const limitedRes = await limited(await jwks.sign(oidc({ email })));
    expect(limitedRes.statusCode).toBe(409);
  });

  it('F-3 tokens Meta or the signature check refuse ⇒ 401 SOCIAL_TOKEN_INVALID', async () => {
    graph.debug = FakeGraphServer.validDebug({ app_id: 'other-app' });
    const wrongApp = await classic(enabled);
    expect(wrongApp.statusCode).toBe(401);
    expect(wrongApp.json<Problem>().code).toBe('SOCIAL_TOKEN_INVALID');

    graph.debug = FakeGraphServer.validDebug({ is_valid: false });
    expect((await classic(enabled)).statusCode).toBe(401);

    const badNonce = await limited(await jwks.sign(oidc()), 'another-nonce-value');
    expect(badNonce.statusCode).toBe(401);
    expect(badNonce.json<Problem>().code).toBe('SOCIAL_TOKEN_INVALID');
    expect((await limited(jwks.unsigned(oidc()))).statusCode).toBe(401);
  });

  it('F-4 Meta being down is 503 RETRY_LATER, not a rejected login', async () => {
    graph.debug = { status: 503, body: '' };
    const res = await classic(enabled);
    expect(res.statusCode).toBe(503);
    expect(res.json<Problem>().code).toBe('RETRY_LATER');
  });

  it('F-5 without FACEBOOK_APP_ID/SECRET the endpoint is unavailable (404)', async () => {
    const res = await classic(disabled);
    expect(res.statusCode).toBe(404);
  });

  it('F-6 the app secret, tokens and emails never reach the logs', async () => {
    const email = `${unique('log')}@example.com`;
    const fbId = unique('fb');
    graph.debug = FakeGraphServer.validDebug({ user_id: fbId });
    graph.me = FakeGraphServer.validMe({ id: fbId, email });
    await classic(enabled, 'EAAB-log-check-token');
    graph.debug = { status: 503, body: '' };
    await classic(enabled, 'EAAB-log-check-token-2');

    const logs = enabled.logLines.join('\n');
    for (const needle of ['api-test-app-secret', 'EAAB-log-check-token', email, fbId]) {
      expect(logs).not.toContain(needle);
    }
  });
});

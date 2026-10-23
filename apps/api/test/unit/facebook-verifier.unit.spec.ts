import { createHash, createHmac } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RetryLaterError } from '../../src/db/errors';
import { SocialTokenInvalidError } from '../../src/modules/auth-users/domain/social';
import { FacebookIdentityVerifier } from '../../src/modules/auth-users/providers/meta/facebook-identity-verifier';
import { FakeClock } from '../support/fake-clock';
import { FakeGraphServer } from '../support/fake-graph-server';
import { FakeJwksServer } from '../support/fake-jwks-server';

const APP_ID = 'app-123';
const APP_SECRET = 's3cr3t-app-secret';
const START = '2030-01-01T00:00:00Z';
const NONCE = 'nonce-abcdef-123456';

let graph: FakeGraphServer;
let jwks: FakeJwksServer;
let clock: FakeClock;
let warnings: string[];
let verifier: FacebookIdentityVerifier;

const logger = { warn: (message: string) => void warnings.push(message) };
const newVerifier = (overrides: Record<string, unknown> = {}) =>
  new FacebookIdentityVerifier(
    {
      appId: APP_ID,
      appSecret: APP_SECRET,
      graphUrl: graph.url,
      jwksUrl: jwks.url,
      timeoutMs: 300,
      ...overrides,
    },
    clock,
    logger,
  );
const classic = (accessToken = 'EAAB-user-token', v = verifier) =>
  v.verify({ provider: 'facebook', accessToken });
const limited = (authenticationToken: string, nonce = NONCE, v = verifier) =>
  v.verify({ provider: 'facebook', authenticationToken, nonce });
const expectInvalid = (promise: Promise<unknown>) =>
  expect(promise).rejects.toBeInstanceOf(SocialTokenInvalidError);
const expectRetryLater = (promise: Promise<unknown>) =>
  expect(promise).rejects.toBeInstanceOf(RetryLaterError);

const nowSec = () => Math.floor(clock.now().getTime() / 1000);
const oidc = (overrides: Record<string, unknown> = {}) => ({
  iss: 'https://www.facebook.com',
  aud: APP_ID,
  sub: 'limited-sub-1',
  nonce: NONCE,
  name: 'Farah Khan',
  email: 'farah@example.com',
  iat: nowSec(),
  exp: nowSec() + 3600,
  ...overrides,
});

beforeAll(async () => {
  graph = await FakeGraphServer.start();
  jwks = await FakeJwksServer.start();
});
afterAll(async () => {
  await graph.stop();
  await jwks.stop();
});
beforeEach(() => {
  clock = new FakeClock(START);
  warnings = [];
  graph.reset();
  jwks.mode = 'ok';
  jwks.fetchCount = 0;
  verifier = newVerifier();
});

describe('Classic Login (access token)', () => {
  it('M-1 a valid token yields the identity; the email is NEVER verified', async () => {
    expect(await classic()).toEqual({
      provider: 'facebook',
      subject: 'fb-user-1',
      email: 'farah@example.com',
      emailVerified: false,
      name: 'Farah Khan',
    });
  });

  it('M-1b Meta is asked with the app token, the user token, and an appsecret_proof', async () => {
    await classic('EAAB-user-token');
    const [debug, me] = graph.requests;
    expect(debug?.path).toBe('/debug_token');
    expect(debug?.query.get('input_token')).toBe('EAAB-user-token');
    expect(debug?.query.get('access_token')).toBe(`${APP_ID}|${APP_SECRET}`);
    expect(me?.path).toBe('/me');
    expect(me?.query.get('fields')).toBe('id,name,email');
    expect(me?.query.get('access_token')).toBe('EAAB-user-token');
    expect(me?.query.get('appsecret_proof')).toBe(
      createHmac('sha256', APP_SECRET).update('EAAB-user-token').digest('hex'),
    );
  });

  it('M-2 a missing email is simply null (profile completion happens later)', async () => {
    graph.me = FakeGraphServer.validMe({ email: undefined });
    expect(await classic()).toMatchObject({ email: null, emailVerified: false });
    graph.me = FakeGraphServer.validMe({ email: '', name: undefined });
    expect(await classic()).toMatchObject({ email: null, name: null });
  });

  it('M-3 a token issued to a different Meta app is rejected', async () => {
    graph.debug = FakeGraphServer.validDebug({ app_id: 'someone-elses-app' });
    await expectInvalid(classic());
  });

  it('M-4 an invalid token is rejected', async () => {
    graph.debug = FakeGraphServer.validDebug({ is_valid: false });
    await expectInvalid(classic());
  });

  it('M-5 expiry uses the injected clock; expires_at 0 means it does not expire', async () => {
    graph.debug = FakeGraphServer.validDebug({ expires_at: nowSec() + 60 });
    await expect(classic()).resolves.toBeTruthy();
    clock.advance(61_000);
    await expectInvalid(classic());

    graph.debug = FakeGraphServer.validDebug({ expires_at: 0 });
    await expect(classic()).resolves.toBeTruthy();
  });

  it.each(['PAGE', 'APP', undefined])('M-6 token type %s is not a user token', async (type) => {
    graph.debug = FakeGraphServer.validDebug({ type });
    await expectInvalid(classic());
  });

  it('M-7 a /me id that disagrees with the debugged user is rejected', async () => {
    graph.me = FakeGraphServer.validMe({ id: 'someone-else' });
    await expectInvalid(classic());
  });

  it.each([
    ['no user_id', FakeGraphServer.validDebug({ user_id: undefined })],
    ['no data', { status: 200, body: {} }],
    ['not an object', { status: 200, body: '"text"' }],
  ])('M-7b a debug answer with %s is rejected', async (_name, reply) => {
    graph.debug = reply;
    await expectInvalid(classic());
  });

  it('M-8 Meta rejecting the token (4xx with an error body) is an invalid token', async () => {
    graph.debug = {
      status: 400,
      body: { error: { message: 'Invalid OAuth access token', type: 'OAuthException', code: 190 } },
    };
    await expectInvalid(classic());

    graph.debug = FakeGraphServer.validDebug();
    graph.me = { status: 400, body: { error: { code: 190 } } };
    await expectInvalid(classic());
  });

  it('M-8b a refused token is logged for operators with status and code only (a bad app secret looks like this)', async () => {
    graph.debug = {
      status: 400,
      body: { error: { message: 'Invalid OAuth access token EAAB-secret', code: 190 } },
    };
    await expectInvalid(classic('EAAB-secret-user-token'));
    expect(warnings).toEqual(['Meta Graph API refused a token (status=400, code=190)']);
  });

  it.each([500, 502, 503, 429])(
    'M-9 Meta answering %i is 503 RETRY_LATER, not an invalid token',
    async (status) => {
      graph.debug = { status, body: { error: { code: 2 } } };
      await expectRetryLater(classic());
      expect(warnings).toHaveLength(1);
    },
  );

  it('M-9b a /me failure after a good debug answer is also RETRY_LATER', async () => {
    graph.me = { status: 503, body: '' };
    await expectRetryLater(classic());
  });

  it('M-9c unreachable and hanging Meta are RETRY_LATER', async () => {
    await expectRetryLater(classic('t', newVerifier({ graphUrl: 'http://127.0.0.1:1' })));
    graph.hang = true;
    await expectRetryLater(classic());
  });

  it('M-10 a 200 with unreadable JSON is RETRY_LATER (Meta misbehaving), never a login', async () => {
    graph.debug = { status: 200, body: '{ not json' };
    await expectRetryLater(classic());
  });

  it.each(['', 'a'.repeat(5000)])(
    'M-14 empty or oversized access tokens never reach Meta',
    async (token) => {
      await expectInvalid(classic(token));
      expect(graph.requests).toHaveLength(0);
    },
  );
});

describe('Limited Login (OIDC authentication token)', () => {
  it('M-11 a valid token yields the identity; email from the token is unverified', async () => {
    expect(await limited(await jwks.sign(oidc()))).toEqual({
      provider: 'facebook',
      subject: 'limited-sub-1',
      email: 'farah@example.com',
      emailVerified: false,
      name: 'Farah Khan',
    });
    expect(graph.requests).toHaveLength(0); // no Graph call in this mode
  });

  it('M-11b a token without email or name still verifies', async () => {
    const token = await jwks.sign(oidc({ email: undefined, name: undefined }));
    expect(await limited(token)).toMatchObject({ email: null, name: null });
  });

  it('M-12 the nonce must match what the app supplied', async () => {
    const token = await jwks.sign(oidc());
    await expectInvalid(limited(token, 'a-different-nonce'));
    await expectInvalid(limited(await jwks.sign(oidc({ nonce: undefined }))));
    await expectInvalid(limited(await jwks.sign(oidc({ nonce: 'other' }))));
  });

  it('M-12b the SHA-256 hex of the nonce is accepted too (Meta does not document which form the claim has)', async () => {
    const hashed = createHash('sha256').update(NONCE).digest('hex');
    await expect(limited(await jwks.sign(oidc({ nonce: hashed })))).resolves.toBeTruthy();
    const otherHash = createHash('sha256').update('other').digest('hex');
    await expectInvalid(limited(await jwks.sign(oidc({ nonce: otherHash }))));
  });

  it('M-13 forgeries and misuse are rejected', async () => {
    await expectInvalid(limited(await jwks.sign(oidc({ aud: 'other-app' }))));
    await expectInvalid(limited(await jwks.sign(oidc({ iss: 'https://evil.example' }))));
    await expectInvalid(limited(await jwks.sign(oidc({ exp: nowSec() - 60 }))));
    await expectInvalid(limited(await jwks.sign(oidc({ sub: undefined }))));
    await expectInvalid(
      limited(await jwks.sign(oidc(), { signWith: await jwks.unpublishedKey() })),
    );
    await expectInvalid(limited(jwks.unsigned(oidc())));
    await expectInvalid(limited(await jwks.hmacWithPublicKey(oidc())));
    await expectInvalid(limited('not-a-jwt'));
  });

  it.each(['', 'a'.repeat(9000)])(
    'M-14b empty or oversized tokens are rejected before any fetch',
    async (token) => {
      await expectInvalid(limited(token));
      expect(jwks.fetchCount).toBe(0);
    },
  );

  it('M-14c an empty or oversized nonce is rejected', async () => {
    const token = await jwks.sign(oidc());
    await expectInvalid(limited(token, ''));
    await expectInvalid(limited(token, 'n'.repeat(300)));
  });

  it('M-13b Meta key endpoint down with a cold cache is RETRY_LATER', async () => {
    jwks.mode = 'server-error';
    await expectRetryLater(limited(await jwks.sign(oidc())));
  });
});

describe('shared behaviour', () => {
  it('M-15 credentials of another provider are rejected', async () => {
    await expectInvalid(verifier.verify({ provider: 'google', idToken: 'x' }));
  });

  it('M-16 nothing sensitive reaches the logs', async () => {
    graph.debug = { status: 503, body: '' };
    await classic('EAAB-very-secret-user-token').catch(() => undefined);
    const token = await jwks.sign(oidc({ aud: 'other' }));
    await limited(token).catch(() => undefined);
    const logged = warnings.join('\n');
    for (const needle of [APP_SECRET, 'EAAB-very-secret-user-token', token, 'farah@example.com']) {
      expect(logged).not.toContain(needle);
    }
  });
});

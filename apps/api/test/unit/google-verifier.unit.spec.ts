import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RetryLaterError } from '../../src/db/errors';
import { GoogleIdentityVerifier } from '../../src/modules/auth-users/providers/google/google-identity-verifier';
import { SocialTokenInvalidError } from '../../src/modules/auth-users/domain/social';
import { FakeClock } from '../support/fake-clock';
import { FakeJwksServer } from '../support/fake-jwks-server';

const CLIENT = '1111-web.apps.googleusercontent.com';
const OTHER_CLIENT = '2222-android.apps.googleusercontent.com';
const START = '2030-01-01T00:00:00Z';
const MIN = 60_000;
const HOUR = 60 * MIN;

let server: FakeJwksServer;
let clock: FakeClock;
let warnings: string[];
let verifier: GoogleIdentityVerifier;

const logger = { warn: (message: string) => void warnings.push(message) };
const newVerifier = (clientIds = [CLIENT], jwksUrl = server.url) =>
  new GoogleIdentityVerifier({ clientIds, jwksUrl }, clock, logger);

const nowSec = () => Math.floor(clock.now().getTime() / 1000);
const claims = (overrides: Record<string, unknown> = {}) => ({
  iss: 'https://accounts.google.com',
  aud: CLIENT,
  sub: '110169484474386276334',
  email: 'asha@example.com',
  email_verified: true,
  name: 'Asha Rao',
  iat: nowSec(),
  exp: nowSec() + 10 * 24 * 3600, // long-lived so tests that move the Clock stay about the cache, not expiry
  ...overrides,
});
const verify = (idToken: string, v = verifier) => v.verify({ provider: 'google', idToken });
const expectInvalid = (promise: Promise<unknown>) =>
  expect(promise).rejects.toBeInstanceOf(SocialTokenInvalidError);

beforeAll(async () => {
  server = await FakeJwksServer.start();
});
afterAll(async () => {
  await server.stop();
});
beforeEach(async () => {
  clock = new FakeClock(START);
  warnings = [];
  server.mode = 'ok';
  server.cacheControl = 'public, max-age=3600';
  server.fetchCount = 0;
  for (const kid of [...server.keys.keys()]) if (kid !== 'key-1') server.removeKey(kid);
  if (!server.keys.has('key-1')) await server.addKey('key-1');
  verifier = newVerifier();
});

describe('accepting valid tokens', () => {
  it('G-1 a valid token yields the identity keyed on sub', async () => {
    const identity = await verify(await server.sign(claims()));
    expect(identity).toEqual({
      provider: 'google',
      subject: '110169484474386276334',
      email: 'asha@example.com',
      emailVerified: true,
      name: 'Asha Rao',
    });
  });

  it('G-1b both Google issuer spellings are accepted', async () => {
    await expect(
      verify(await server.sign(claims({ iss: 'accounts.google.com' }))),
    ).resolves.toBeTruthy();
    await expect(
      verify(await server.sign(claims({ iss: 'https://accounts.google.com' }))),
    ).resolves.toBeTruthy();
  });

  it.each([
    [true, true],
    ['true', true],
    [false, false],
    ['false', false],
    ['yes', false],
    [1, false],
    [undefined, false],
  ])('G-2 email_verified=%j ⇒ emailVerified=%s', async (value, expected) => {
    const token = await server.sign(claims({ email_verified: value }));
    expect((await verify(token)).emailVerified).toBe(expected);
  });

  it('G-2b a token without email or name still verifies (they are optional attributes)', async () => {
    const token = await server.sign(
      claims({ email: undefined, email_verified: undefined, name: undefined }),
    );
    expect(await verify(token)).toMatchObject({ email: null, emailVerified: false, name: null });
  });

  it('G-2c email_verified without an email can never mean verified', async () => {
    const token = await server.sign(claims({ email: undefined, email_verified: true }));
    expect((await verify(token)).emailVerified).toBe(false);
  });

  it('G-9 tokens for any configured client ID are accepted', async () => {
    const both = newVerifier([CLIENT, OTHER_CLIENT]);
    await expect(verify(await server.sign(claims({ aud: CLIENT })), both)).resolves.toBeTruthy();
    await expect(
      verify(await server.sign(claims({ aud: OTHER_CLIENT })), both),
    ).resolves.toBeTruthy();
    await expect(
      verify(await server.sign(claims({ aud: ['someone-else', OTHER_CLIENT] })), both),
    ).resolves.toBeTruthy();
  });
});

describe('rejecting forgeries and misuse', () => {
  it('G-3 a token issued for another Google client is rejected', async () => {
    await expectInvalid(verify(await server.sign(claims({ aud: OTHER_CLIENT }))));
    await expectInvalid(verify(await server.sign(claims({ aud: undefined }))));
  });

  it.each([
    'https://evil.example',
    'accounts.google.com.evil.example',
    'http://accounts.google.com',
  ])('G-4 issuer %s is rejected', async (iss) => {
    await expectInvalid(verify(await server.sign(claims({ iss }))));
  });

  it('G-5 expired and not-yet-valid tokens are rejected', async () => {
    const expired = await server.sign(claims({ exp: nowSec() + 60 }));
    await expect(verify(expired)).resolves.toBeTruthy();
    clock.advance(HOUR);
    await expectInvalid(verify(expired));

    const early = await server.sign(claims({ nbf: nowSec() + 3600 }));
    await expectInvalid(verify(early));
  });

  it('G-5b a small clock skew is tolerated, a large one is not', async () => {
    await expect(verify(await server.sign(claims({ exp: nowSec() - 5 })))).resolves.toBeTruthy();
    await expectInvalid(verify(await server.sign(claims({ exp: nowSec() - 60 }))));
  });

  it('G-6 a token signed by a key Google never published is rejected, even with a published kid', async () => {
    const forged = await server.sign(claims(), { signWith: await server.unpublishedKey() });
    await expectInvalid(verify(forged));
  });

  it('G-6b a tampered payload is rejected', async () => {
    const [header, , signature] = (await server.sign(claims())).split('.');
    const payload = Buffer.from(JSON.stringify(claims({ sub: 'victim' }))).toString('base64url');
    await expectInvalid(verify(`${header}.${payload}.${signature}`));
  });

  it('G-7 alg=none is rejected', async () => {
    await expectInvalid(verify(server.unsigned(claims())));
  });

  it('G-7b HS256 keyed with the public key material (algorithm confusion) is rejected', async () => {
    await expectInvalid(verify(await server.hmacWithPublicKey(claims())));
  });

  it.each([
    ['missing sub', { sub: undefined }],
    ['empty sub', { sub: '' }],
    ['non-string sub', { sub: 42 }],
    ['missing exp', { exp: undefined }],
  ])('G-8 %s is rejected', async (_name, overrides) => {
    await expectInvalid(verify(await server.sign(claims(overrides))));
  });

  it.each(['', 'not-a-jwt', 'a.b', 'a.b.c', '....'])(
    'G-8b garbage %j is rejected',
    async (garbage) => {
      await expectInvalid(verify(garbage));
    },
  );

  it('G-8c an oversized token is rejected before any key is fetched', async () => {
    await expectInvalid(verify('a'.repeat(9000)));
    expect(server.fetchCount).toBe(0);
  });

  it('G-8d credentials for another provider are rejected', async () => {
    await expectInvalid(verifier.verify({ provider: 'apple', identityToken: 'x', nonce: 'n' }));
  });
});

describe('key cache (Cache-Control) and rotation', () => {
  const verifyFresh = async () => verify(await server.sign(claims()));

  it('G-13 max-age is honoured: no refetch inside it, refetch after it', async () => {
    server.cacheControl = 'public, max-age=120';
    await verifyFresh();
    clock.advance(119_000);
    await verifyFresh();
    expect(server.fetchCount).toBe(1);

    clock.advance(2_000);
    await verifyFresh();
    expect(server.fetchCount).toBe(2);
  });

  it('G-13b header spelling variants are parsed', async () => {
    server.cacheControl = 'PUBLIC, Max-Age=300, must-revalidate, no-transform';
    await verifyFresh();
    clock.advance(299_000);
    await verifyFresh();
    expect(server.fetchCount).toBe(1);
    clock.advance(2_000);
    await verifyFresh();
    expect(server.fetchCount).toBe(2);
  });

  it('G-13c without a usable header keys are cached for one hour', async () => {
    for (const header of [undefined, 'public', 'max-age=abc', 'no-store']) {
      server.cacheControl = header;
      server.fetchCount = 0;
      const v = newVerifier();
      await verify(await server.sign(claims()), v);
      clock.advance(HOUR - 1000);
      await verify(await server.sign(claims()), v);
      expect(server.fetchCount, `header ${String(header)}`).toBe(1);
      clock.advance(2000);
      await verify(await server.sign(claims()), v);
      expect(server.fetchCount, `header ${String(header)}`).toBe(2);
      clock.set(START);
    }
  });

  it('G-13d the lifetime is clamped to between one minute and one day', async () => {
    server.cacheControl = 'max-age=5';
    await verifyFresh();
    clock.advance(59_000);
    await verifyFresh();
    expect(server.fetchCount).toBe(1);
    clock.advance(2_000);
    await verifyFresh();
    expect(server.fetchCount).toBe(2);

    clock.set(START);
    server.fetchCount = 0;
    const long = newVerifier();
    server.cacheControl = 'max-age=99999999';
    await verify(await server.sign(claims()), long);
    clock.advance(24 * HOUR - 1000);
    await verify(await server.sign(claims()), long);
    expect(server.fetchCount).toBe(1);
    clock.advance(2000);
    await verify(await server.sign(claims()), long);
    expect(server.fetchCount).toBe(2);
  });

  it('G-14 rotation: a key published after the last fetch is picked up on first use', async () => {
    await verifyFresh();
    await server.addKey('key-2');
    const token = await server.sign(claims(), { kid: 'key-2' });
    expect((await verify(token)).subject).toBe('110169484474386276334');
    expect(server.fetchCount).toBe(2);
  });

  it('G-15 a retired key stops working after the next refresh', async () => {
    await server.addKey('key-2');
    const oldToken = await server.sign(claims(), { kid: 'key-1' });
    await expect(verify(oldToken)).resolves.toBeTruthy();

    server.removeKey('key-1');
    clock.advance(2 * HOUR); // cache expired ⇒ refresh drops key-1
    await expectInvalid(verify(oldToken));
    await expect(verify(await server.sign(claims(), { kid: 'key-2' }))).resolves.toBeTruthy();
  });

  it('G-16 unknown key ids cannot force a fetch per request', async () => {
    await verifyFresh();
    expect(server.fetchCount).toBe(1);
    const stranger = await server.unpublishedKey();

    const attempts = Array.from({ length: 50 }, async (_unused, index) =>
      verify(await server.sign(claims(), { kid: `ghost-${index}`, signWith: stranger })).catch(
        (error: unknown) => error,
      ),
    );
    const results = await Promise.all(attempts);
    expect(results.every((r) => r instanceof SocialTokenInvalidError)).toBe(true);
    expect(server.fetchCount).toBe(2); // one refetch for the whole burst

    clock.advance(10_000);
    await expectInvalid(verify(await server.sign(claims(), { kid: 'ghost', signWith: stranger })));
    expect(server.fetchCount).toBe(2); // still inside the 30 s window

    clock.advance(21_000);
    await expectInvalid(verify(await server.sign(claims(), { kid: 'ghost', signWith: stranger })));
    expect(server.fetchCount).toBe(3);
  });

  it('G-17 concurrent cold verifications share one fetch', async () => {
    const token = await server.sign(claims());
    const results = await Promise.all(Array.from({ length: 20 }, () => verify(token)));
    expect(results).toHaveLength(20);
    expect(server.fetchCount).toBe(1);
  });
});

describe('Google endpoint trouble', () => {
  it.each(['server-error', 'bad-json'] as const)(
    'G-18 %s with a warm cache: stale keys keep working, the failure is logged without detail, no hammering',
    async (mode) => {
      server.cacheControl = 'max-age=120';
      await verify(await server.sign(claims()));
      server.mode = mode;
      clock.advance(5 * MIN);

      await expect(verify(await server.sign(claims()))).resolves.toBeTruthy();
      expect(server.fetchCount).toBe(2);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatch(/signing keys/i);

      await expect(verify(await server.sign(claims()))).resolves.toBeTruthy();
      expect(server.fetchCount).toBe(2); // retry only after the back-off, not on every request

      server.mode = 'ok';
      clock.advance(31_000);
      await verify(await server.sign(claims()));
      expect(server.fetchCount).toBe(3);
    },
  );

  it.each(['server-error', 'bad-json'] as const)(
    'G-19 %s with a cold cache is 503 RETRY_LATER, not an invalid token',
    async (mode) => {
      server.mode = mode;
      await expect(verify(await server.sign(claims()))).rejects.toBeInstanceOf(RetryLaterError);
    },
  );

  it('G-19b an unreachable endpoint with a cold cache is 503 RETRY_LATER', async () => {
    const unreachable = newVerifier([CLIENT], 'http://127.0.0.1:1/certs');
    await expect(verify(await server.sign(claims()), unreachable)).rejects.toBeInstanceOf(
      RetryLaterError,
    );
  });
});

describe('logging', () => {
  it('G-22 failures never log the token, email or subject', async () => {
    const token = await server.sign(claims({ aud: OTHER_CLIENT }));
    await expectInvalid(verify(token));
    server.mode = 'server-error';
    await verify(await server.sign(claims())).catch(() => undefined);
    const logged = warnings.join('\n');
    for (const needle of [token, 'asha@example.com', '110169484474386276334']) {
      expect(logged).not.toContain(needle);
    }
  });
});

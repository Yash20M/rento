import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RetryLaterError } from '../../src/db/errors';
import { SocialTokenInvalidError } from '../../src/modules/auth-users/domain/social';
import { AppleIdentityVerifier } from '../../src/modules/auth-users/providers/apple/apple-identity-verifier';
import { FakeClock } from '../support/fake-clock';
import { FakeJwksServer } from '../support/fake-jwks-server';

const BUNDLE = 'com.rento.app';
const SERVICE = 'com.rento.web';
const NONCE = 'raw-nonce-abcdef-123456';
const START = '2030-01-01T00:00:00Z';
const sha256hex = (value: string) => createHash('sha256').update(value).digest('hex');

let jwks: FakeJwksServer;
let clock: FakeClock;
let warnings: string[];
let verifier: AppleIdentityVerifier;

const logger = { warn: (message: string) => void warnings.push(message) };
const newVerifier = (clientIds = [BUNDLE], jwksUrl = jwks.url) =>
  new AppleIdentityVerifier({ clientIds, jwksUrl }, clock, logger);
const nowSec = () => Math.floor(clock.now().getTime() / 1000);
const claims = (overrides: Record<string, unknown> = {}) => ({
  iss: 'https://appleid.apple.com',
  aud: BUNDLE,
  sub: '001234.abcdef0123456789.0101',
  nonce: NONCE,
  email: 'asha@example.com',
  email_verified: true,
  iat: nowSec(),
  exp: nowSec() + 3600,
  ...overrides,
});
const verify = (identityToken: string, nonce = NONCE, v = verifier) =>
  v.verify({ provider: 'apple', identityToken, nonce });
const expectInvalid = (promise: Promise<unknown>) =>
  expect(promise).rejects.toBeInstanceOf(SocialTokenInvalidError);

beforeAll(async () => {
  jwks = await FakeJwksServer.start();
});
afterAll(async () => {
  await jwks.stop();
});
beforeEach(() => {
  clock = new FakeClock(START);
  warnings = [];
  jwks.mode = 'ok';
  jwks.fetchCount = 0;
  verifier = newVerifier();
});

describe('accepting valid tokens', () => {
  it('A-1 a valid token yields the identity keyed on sub (no name: Apple sends it outside the token)', async () => {
    expect(await verify(await jwks.sign(claims()))).toEqual({
      provider: 'apple',
      subject: '001234.abcdef0123456789.0101',
      email: 'asha@example.com',
      emailVerified: true,
      name: null,
    });
  });

  it.each([
    [true, true],
    ['true', true],
    [false, false],
    ['false', false],
    [undefined, false],
    ['1', false],
  ])('A-2 email_verified=%j ⇒ emailVerified=%s', async (value, expected) => {
    const token = await jwks.sign(claims({ email_verified: value }));
    expect((await verify(token)).emailVerified).toBe(expected);
  });

  it('A-2b no email ⇒ null and never verified', async () => {
    const token = await jwks.sign(claims({ email: undefined, email_verified: true }));
    expect(await verify(token)).toMatchObject({ email: null, emailVerified: false });
  });

  it('A-3 a private-relay address is a normal, verified email', async () => {
    const relay = 'k3j2h1g@privaterelay.appleid.com';
    const token = await jwks.sign(
      claims({ email: relay, email_verified: 'true', is_private_email: 'true' }),
    );
    expect(await verify(token)).toMatchObject({ email: relay, emailVerified: true });
  });

  it('A-5b tokens for the bundle ID or the Services ID are both accepted when both are configured', async () => {
    const both = newVerifier([BUNDLE, SERVICE]);
    await expect(
      verify(await jwks.sign(claims({ aud: BUNDLE })), NONCE, both),
    ).resolves.toBeTruthy();
    await expect(
      verify(await jwks.sign(claims({ aud: SERVICE })), NONCE, both),
    ).resolves.toBeTruthy();
  });
});

describe('nonce', () => {
  it('A-4 the raw nonce is accepted', async () => {
    await expect(verify(await jwks.sign(claims({ nonce: NONCE })))).resolves.toBeTruthy();
  });

  it('A-4b the SHA-256 hex of the nonce is accepted too (libraries differ)', async () => {
    await expect(
      verify(await jwks.sign(claims({ nonce: sha256hex(NONCE) }))),
    ).resolves.toBeTruthy();
  });

  it('A-4c a different, missing, or empty nonce is rejected', async () => {
    const token = await jwks.sign(claims());
    await expectInvalid(verify(token, 'another-nonce-entirely'));
    await expectInvalid(verify(token, ''));
    await expectInvalid(verify(await jwks.sign(claims({ nonce: undefined }))));
    await expectInvalid(verify(await jwks.sign(claims({ nonce: 'something-else' }))));
    await expectInvalid(verify(await jwks.sign(claims({ nonce: sha256hex('other') }))));
  });

  it('A-4d an oversized nonce is rejected without a key fetch', async () => {
    await expectInvalid(verify(await jwks.sign(claims()), 'n'.repeat(300)));
    expect(jwks.fetchCount).toBe(0);
  });
});

describe('rejecting forgeries and misuse', () => {
  it('A-5 a token for another app is rejected', async () => {
    await expectInvalid(verify(await jwks.sign(claims({ aud: 'com.someone.else' }))));
    await expectInvalid(verify(await jwks.sign(claims({ aud: undefined }))));
  });

  it.each(['https://evil.example', 'appleid.apple.com', 'https://appleid.apple.com.evil.example'])(
    'A-6 issuer %s is rejected',
    async (iss) => {
      await expectInvalid(verify(await jwks.sign(claims({ iss }))));
    },
  );

  it('A-7 expired and not-yet-valid tokens are rejected', async () => {
    await expectInvalid(verify(await jwks.sign(claims({ exp: nowSec() - 60 }))));
    await expectInvalid(verify(await jwks.sign(claims({ nbf: nowSec() + 3600 }))));
  });

  it('A-8 forgeries are rejected', async () => {
    await expectInvalid(
      verify(await jwks.sign(claims(), { signWith: await jwks.unpublishedKey() })),
    );
    const [header, , signature] = (await jwks.sign(claims())).split('.');
    const payload = Buffer.from(JSON.stringify(claims({ sub: 'victim' }))).toString('base64url');
    await expectInvalid(verify(`${header}.${payload}.${signature}`));
    await expectInvalid(verify(jwks.unsigned(claims())));
    await expectInvalid(verify(await jwks.hmacWithPublicKey(claims())));
  });

  it.each([
    ['missing sub', { sub: undefined }],
    ['empty sub', { sub: '' }],
    ['non-string sub', { sub: 7 }],
  ])('A-9 %s is rejected', async (_name, overrides) => {
    await expectInvalid(verify(await jwks.sign(claims(overrides))));
  });

  it.each(['', 'garbage', 'a.b.c'])('A-9b garbage %j is rejected', async (token) => {
    await expectInvalid(verify(token));
  });

  it('A-9c an oversized token is rejected before any fetch', async () => {
    await expectInvalid(verify('a'.repeat(9000)));
    expect(jwks.fetchCount).toBe(0);
  });

  it('A-10 credentials of another provider are rejected', async () => {
    await expectInvalid(verifier.verify({ provider: 'google', idToken: 'x' }));
  });
});

describe('infrastructure and logging', () => {
  it('A-11 Apple key endpoint down with a cold cache is 503 RETRY_LATER', async () => {
    jwks.mode = 'server-error';
    await expect(verify(await jwks.sign(claims()))).rejects.toBeInstanceOf(RetryLaterError);
  });

  it('A-11b the key set is cached (one fetch for many logins)', async () => {
    for (let i = 0; i < 5; i += 1) await verify(await jwks.sign(claims()));
    expect(jwks.fetchCount).toBe(1);
  });

  it('A-12 nothing sensitive reaches the logs', async () => {
    const token = await jwks.sign(claims({ aud: 'nope' }));
    await expectInvalid(verify(token));
    jwks.mode = 'server-error';
    await newVerifier()
      .verify({ provider: 'apple', identityToken: token, nonce: NONCE })
      .catch(() => undefined);
    const logged = warnings.join('\n');
    for (const needle of [token, 'asha@example.com', '001234.abcdef0123456789.0101', NONCE]) {
      expect(logged).not.toContain(needle);
    }
  });
});

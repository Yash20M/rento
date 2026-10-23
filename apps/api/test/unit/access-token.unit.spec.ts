import { SignJWT, decodeJwt, decodeProtectedHeader } from 'jose';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/app-config';
import {
  ExpiredAccessTokenError,
  InvalidAccessTokenError,
} from '../../src/modules/auth-users/domain/auth-errors';
import { AccessTokenService } from '../../src/modules/auth-users/services/access-token.service';
import { FakeClock } from '../support/fake-clock';

const SECRET = 'current-secret-0123456789abcdef-current';
const PREVIOUS = 'previous-secret-0123456789abcdef-prev';
const userId = '0b1f6c1e-3c1a-4f55-9d2e-6a1b2c3d4e5f';
const encode = (secret: string) => new TextEncoder().encode(secret);

function make(overrides: Record<string, string> = {}, start = '2030-01-01T00:00:00Z') {
  const config = loadConfig({
    DATABASE_URL: 'postgres://u:p@127.0.0.1:5433/db',
    JWT_SECRET: SECRET,
    ...overrides,
  });
  const clock = new FakeClock(start);
  return { service: new AccessTokenService(config, clock), clock };
}

const nowSeconds = (clock: FakeClock) => Math.floor(clock.now().getTime() / 1000);

/** Signs a token like the real service would, with overridable pieces — for forging bad ones. */
async function forge(
  clock: FakeClock,
  options: {
    secret?: string;
    alg?: string;
    iss?: string;
    aud?: string;
    exp?: number;
    sub?: string;
  } = {},
) {
  const iat = nowSeconds(clock);
  return new SignJWT({})
    .setProtectedHeader({ alg: options.alg ?? 'HS256' })
    .setSubject(options.sub ?? userId)
    .setIssuer(options.iss ?? 'rento-api')
    .setAudience(options.aud ?? 'rento-clients')
    .setIssuedAt(iat)
    .setExpirationTime(options.exp ?? iat + 900)
    .setJti('forged-jti')
    .sign(encode(options.secret ?? SECRET));
}

describe('AccessTokenService', () => {
  it('U-07 issues an HS256 JWT with exactly the minimal claims', async () => {
    const { service, clock } = make();
    const { token, expiresInSeconds } = await service.issue(userId);

    expect(expiresInSeconds).toBe(900);
    expect(decodeProtectedHeader(token)).toMatchObject({ alg: 'HS256' });
    const claims = decodeJwt(token);
    const iat = nowSeconds(clock);
    expect(Object.keys(claims).sort()).toEqual([
      'aud',
      'auth_time',
      'exp',
      'iat',
      'iss',
      'jti',
      'sub',
    ]);
    expect(claims['auth_time']).toBe(iat); // a fresh sign-in
    expect(claims).toMatchObject({
      sub: userId,
      iss: 'rento-api',
      aud: 'rento-clients',
      iat,
      exp: iat + 900,
    });
    expect(claims.jti).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('U-07b every token has a unique jti; TTL follows config', async () => {
    const { service } = make({ ACCESS_TOKEN_TTL_SECONDS: '600' });
    const a = await service.issue(userId);
    const b = await service.issue(userId);
    expect(a.expiresInSeconds).toBe(600);
    expect(decodeJwt(a.token).jti).not.toBe(decodeJwt(b.token).jti);
  });

  it('U-08 verifies a valid token and returns subject and token id', async () => {
    const { service } = make();
    const { token } = await service.issue(userId);
    const verified = await service.verify(token);
    expect(verified.userId).toBe(userId);
    expect(verified.tokenId).toBe(decodeJwt(token).jti);
  });

  it('U-09 expires exactly at exp, judged by the injected clock', async () => {
    const { service, clock } = make();
    const { token } = await service.issue(userId);

    clock.advance(899_000);
    await expect(service.verify(token)).resolves.toBeDefined();
    clock.advance(1_000);
    await expect(service.verify(token)).rejects.toBeInstanceOf(ExpiredAccessTokenError);
  });

  it('U-10 rejects a wrong secret, audience or issuer', async () => {
    const { service, clock } = make();
    for (const bad of [
      await forge(clock, { secret: 'some-other-secret-0123456789abcdef-zz' }),
      await forge(clock, { aud: 'someone-else' }),
      await forge(clock, { iss: 'not-rento' }),
    ]) {
      await expect(service.verify(bad)).rejects.toBeInstanceOf(InvalidAccessTokenError);
    }
  });

  it('U-11 rejects alg=none and any algorithm other than HS256', async () => {
    const { service, clock } = make();
    const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
      sub: userId,
      iss: 'rento-api',
      aud: 'rento-clients',
      iat: nowSeconds(clock),
      exp: nowSeconds(clock) + 900,
    })}.`;
    await expect(service.verify(none)).rejects.toBeInstanceOf(InvalidAccessTokenError);

    const hs512 = await forge(clock, { alg: 'HS512', secret: SECRET + SECRET });
    await expect(service.verify(hs512)).rejects.toBeInstanceOf(InvalidAccessTokenError);
    const sameKeyHs512 = await forge(clock, { alg: 'HS512' });
    await expect(service.verify(sameKeyHs512)).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });

  it('U-12 rejects a tampered payload (signature no longer matches)', async () => {
    const { service } = make();
    const { token } = await service.issue(userId);
    const [header, payload, signature] = token.split('.') as [string, string, string];
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Record<
      string,
      unknown
    >;
    claims['sub'] = '00000000-0000-0000-0000-000000000000';
    const forged = `${header}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.${signature}`;
    await expect(service.verify(forged)).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });

  it('U-13 accepts tokens signed with the previous secret (rotation), but always signs with the current', async () => {
    const { service, clock } = make({ JWT_SECRET_PREVIOUS: PREVIOUS });
    const old = await forge(clock, { secret: PREVIOUS });
    await expect(service.verify(old)).resolves.toMatchObject({ userId });

    const withoutPrevious = make().service;
    await expect(withoutPrevious.verify(old)).rejects.toBeInstanceOf(InvalidAccessTokenError);

    const fresh = await service.issue(userId);
    await expect(withoutPrevious.verify(fresh.token)).resolves.toMatchObject({ userId });
  });

  it.each(['', 'garbage', 'a.b', 'a.b.c', '....', ' '])('U-14 rejects %j', async (bad) => {
    const { service } = make();
    await expect(service.verify(bad)).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });

  it('U-14b a token without a subject is invalid', async () => {
    const { service, clock } = make();
    const noSub = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('rento-api')
      .setAudience('rento-clients')
      .setIssuedAt(nowSeconds(clock))
      .setExpirationTime(nowSeconds(clock) + 900)
      .setJti('x')
      .sign(encode(SECRET));
    await expect(service.verify(noSub)).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });
});

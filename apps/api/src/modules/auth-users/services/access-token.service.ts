import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { SignJWT, errors, jwtVerify } from 'jose';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/config.module';
import { ExpiredAccessTokenError, InvalidAccessTokenError } from '../domain/auth-errors';

export const JWT_ISSUER = 'rento-api';
export const JWT_AUDIENCE = 'rento-clients';
const ALGORITHM = 'HS256';
const encoder = new TextEncoder();

export interface VerifiedAccessToken {
  userId: string;
  tokenId: string;
  /** When the token was issued, in epoch seconds. */
  issuedAt: number;
  /** When the user last actually signed in (epoch seconds); survives refreshes. Falls back to `issuedAt`. */
  authTime: number;
  /** When this session last proved the second step (epoch seconds); absent = it has not. */
  mfaAt: number | undefined;
}

/**
 * Short-lived JWT access tokens (README §15, ADR-012). Minimal claims only: permissions are resolved
 * server-side per request, never embedded. Time comes from the injected Clock.
 */
@Injectable()
export class AccessTokenService {
  private readonly currentKey: Uint8Array;
  private readonly previousKey: Uint8Array | undefined;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.currentKey = encoder.encode(config.jwtSecret);
    this.previousKey =
      config.jwtSecretPrevious === undefined ? undefined : encoder.encode(config.jwtSecretPrevious);
  }

  /** `authTime` is when the user really authenticated (password / provider); omit for a fresh sign-in. */
  async issue(
    userId: string,
    authTime?: Date,
    mfaAt?: Date,
  ): Promise<{ token: string; expiresInSeconds: number }> {
    const ttl = this.config.accessTokenTtlSeconds;
    const issuedAt = Math.floor(this.clock.now().getTime() / 1000);
    const signedInAt = Math.floor((authTime ?? this.clock.now()).getTime() / 1000);
    const token = await new SignJWT({
      auth_time: signedInAt,
      ...(mfaAt && { mfa_at: Math.floor(mfaAt.getTime() / 1000) }),
    })
      .setProtectedHeader({ alg: ALGORITHM })
      .setSubject(userId)
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + ttl)
      .setJti(randomUUID())
      .sign(this.currentKey);
    return { token, expiresInSeconds: ttl };
  }

  /** @throws ExpiredAccessTokenError when only the expiry failed; InvalidAccessTokenError otherwise. */
  async verify(token: string): Promise<VerifiedAccessToken> {
    const keys = this.previousKey ? [this.currentKey, this.previousKey] : [this.currentKey];

    for (const key of keys) {
      try {
        const { payload } = await jwtVerify(token, key, {
          algorithms: [ALGORITHM],
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
          currentDate: this.clock.now(),
        });
        if (
          typeof payload.sub !== 'string' ||
          payload.sub === '' ||
          typeof payload.jti !== 'string' ||
          typeof payload.iat !== 'number'
        ) {
          throw new InvalidAccessTokenError();
        }
        const authTime = payload['auth_time'];
        const mfaAt = payload['mfa_at'];
        return {
          userId: payload.sub,
          tokenId: payload.jti,
          issuedAt: payload.iat,
          authTime: typeof authTime === 'number' ? authTime : payload.iat,
          mfaAt: typeof mfaAt === 'number' ? mfaAt : undefined,
        };
      } catch (error) {
        if (error instanceof InvalidAccessTokenError) throw error;
        if (error instanceof errors.JWTExpired) throw new ExpiredAccessTokenError();
        // Wrong key → try the next one (rotation); anything else (claims, format, algorithm) is final.
        if (!(error instanceof errors.JWSSignatureVerificationFailed)) {
          throw new InvalidAccessTokenError();
        }
      }
    }
    throw new InvalidAccessTokenError();
  }
}

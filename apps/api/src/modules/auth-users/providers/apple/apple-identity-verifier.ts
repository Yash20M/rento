import { createHash } from 'node:crypto';
import { decodeProtectedHeader, jwtVerify } from 'jose';
import type { Clock } from '../../../../common/clock/clock';
import {
  type SocialCredentials,
  type SocialIdentityVerifier,
  SocialTokenInvalidError,
  type VerifiedSocialIdentity,
} from '../../domain/social';
import { type JwksLogger, JwksCache } from '../shared/jwks-cache';

export const APPLE_ISSUER = 'https://appleid.apple.com';
const MAX_TOKEN_LENGTH = 8192;
const MAX_NONCE_LENGTH = 256;
const CLOCK_TOLERANCE_SECONDS = 10;

export interface AppleVerifierSettings {
  /** Our bundle ID (native) and, if the web uses it, the Services ID. A token must be issued for one of them. */
  clientIds: readonly string[];
  jwksUrl: string;
}

const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex');
const text = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null;

/**
 * Verifies a Sign in with Apple identity token (README §15.1): RS256 signature against Apple's published keys,
 * issuer, audience (our bundle/service IDs), expiry and the nonce. Apple is authoritative for the email it reports as
 * verified — including private-relay addresses, which are deliverable. The name is NOT in the token; the app forwards
 * it on the first sign-in and the social core stores it once.
 */
export class AppleIdentityVerifier implements SocialIdentityVerifier {
  private readonly keys: JwksCache;

  constructor(
    private readonly settings: AppleVerifierSettings,
    private readonly clock: Clock,
    logger: JwksLogger,
  ) {
    this.keys = new JwksCache(settings.jwksUrl, clock, logger);
  }

  async verify(credentials: SocialCredentials): Promise<VerifiedSocialIdentity> {
    if (credentials.provider !== 'apple' || !('identityToken' in credentials)) {
      throw new SocialTokenInvalidError();
    }
    const { identityToken: token, nonce } = credentials;
    if (token === '' || token.length > MAX_TOKEN_LENGTH) throw new SocialTokenInvalidError();
    if (nonce === '' || nonce.length > MAX_NONCE_LENGTH) throw new SocialTokenInvalidError();

    let kid: string | undefined;
    try {
      kid = decodeProtectedHeader(token).kid;
    } catch {
      throw new SocialTokenInvalidError();
    }
    const resolver = await this.keys.resolverFor(kid); // key-endpoint trouble ⇒ RetryLaterError

    let payload;
    try {
      ({ payload } = await jwtVerify(token, resolver, {
        algorithms: ['RS256'],
        issuer: APPLE_ISSUER,
        audience: [...this.settings.clientIds],
        requiredClaims: ['sub', 'exp', 'iss', 'aud', 'nonce'],
        clockTolerance: CLOCK_TOLERANCE_SECONDS,
        currentDate: this.clock.now(),
      }));
    } catch {
      throw new SocialTokenInvalidError();
    }

    // Client libraries differ: the token carries the nonce as sent to Apple, either raw or its SHA-256 hex.
    const claimed = payload['nonce'];
    if (claimed !== nonce && claimed !== sha256Hex(nonce)) throw new SocialTokenInvalidError();

    const subject = text(payload.sub);
    if (subject === null) throw new SocialTokenInvalidError();
    const email = text(payload['email']);
    const flag = payload['email_verified'];
    return {
      provider: 'apple',
      subject,
      email,
      emailVerified: email !== null && (flag === true || flag === 'true'),
      name: null,
    };
  }
}

import { decodeProtectedHeader, jwtVerify } from 'jose';
import type { Clock } from '../../../../common/clock/clock';
import {
  type SocialCredentials,
  type SocialIdentityVerifier,
  SocialTokenInvalidError,
  type VerifiedSocialIdentity,
} from '../../domain/social';
import { type JwksLogger, JwksCache } from '../shared/jwks-cache';

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const MAX_TOKEN_LENGTH = 8192;
const CLOCK_TOLERANCE_SECONDS = 10;

export interface GoogleVerifierSettings {
  /** Our OAuth client IDs (Android, iOS, Web). A token must be issued for one of them. */
  clientIds: readonly string[];
  jwksUrl: string;
}

/**
 * Verifies a Google ID token (README §15.1): RS256 signature against Google's published keys, issuer, audience (our
 * client IDs), expiry. The identity key is `sub`; `email` is an attribute, trusted only when Google says it is verified.
 */
export class GoogleIdentityVerifier implements SocialIdentityVerifier {
  private readonly keys: JwksCache;

  constructor(
    private readonly settings: GoogleVerifierSettings,
    private readonly clock: Clock,
    logger: JwksLogger,
  ) {
    this.keys = new JwksCache(settings.jwksUrl, clock, logger);
  }

  async verify(credentials: SocialCredentials): Promise<VerifiedSocialIdentity> {
    if (credentials.provider !== 'google' || !('idToken' in credentials)) {
      throw new SocialTokenInvalidError();
    }
    const token = credentials.idToken;
    if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) throw new SocialTokenInvalidError();

    let kid: string | undefined;
    try {
      kid = decodeProtectedHeader(token).kid;
    } catch {
      throw new SocialTokenInvalidError();
    }
    // Infrastructure trouble (RetryLaterError) is deliberately NOT turned into "invalid token".
    const resolver = await this.keys.resolverFor(kid);

    let payload;
    try {
      ({ payload } = await jwtVerify(token, resolver, {
        algorithms: ['RS256'],
        issuer: GOOGLE_ISSUERS,
        audience: [...this.settings.clientIds],
        requiredClaims: ['sub', 'exp', 'iss', 'aud'],
        clockTolerance: CLOCK_TOLERANCE_SECONDS,
        currentDate: this.clock.now(),
      }));
    } catch {
      throw new SocialTokenInvalidError();
    }

    if (typeof payload.sub !== 'string' || payload.sub === '') throw new SocialTokenInvalidError();
    const email =
      typeof payload['email'] === 'string' && payload['email'] ? payload['email'] : null;
    const flag = payload['email_verified'];
    return {
      provider: 'google',
      subject: payload.sub,
      email,
      emailVerified: email !== null && (flag === true || flag === 'true'),
      name: typeof payload['name'] === 'string' && payload['name'] ? payload['name'] : null,
    };
  }
}

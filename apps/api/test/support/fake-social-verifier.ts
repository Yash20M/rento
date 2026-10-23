import {
  type SocialCredentials,
  type SocialIdentityVerifier,
  type SocialProvider,
  SocialTokenInvalidError,
  type VerifiedSocialIdentity,
} from '../../src/modules/auth-users/domain/social';

/** The token string a client would send, whichever shape the provider uses. */
export function presentedToken(credentials: SocialCredentials): string {
  if ('idToken' in credentials) return credentials.idToken;
  if ('accessToken' in credentials) return credentials.accessToken;
  if ('authenticationToken' in credentials) return credentials.authenticationToken;
  return credentials.identityToken;
}

/**
 * Stands in for a real provider at the adapter interface: a test "issues" a token for an identity, and any other
 * token is rejected exactly like a forged or expired one.
 */
export class FakeSocialVerifier implements SocialIdentityVerifier {
  private readonly granted = new Map<string, VerifiedSocialIdentity>();
  readonly seen: SocialCredentials[] = [];

  constructor(readonly provider: SocialProvider) {}

  grant(
    token: string,
    identity: Partial<Omit<VerifiedSocialIdentity, 'provider'>> & { subject: string },
  ): string {
    this.granted.set(token, {
      provider: this.provider,
      email: null,
      emailVerified: false,
      name: null,
      ...identity,
    });
    return token;
  }

  async verify(credentials: SocialCredentials): Promise<VerifiedSocialIdentity> {
    this.seen.push(credentials);
    const identity = this.granted.get(presentedToken(credentials));
    if (!identity) throw new SocialTokenInvalidError();
    return identity;
  }
}

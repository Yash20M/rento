export const SOCIAL_PROVIDERS = ['google', 'facebook', 'apple'] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

/** What the app sent, per provider. Verifiers receive exactly this and nothing else. */
export type SocialCredentials =
  | { provider: 'google'; idToken: string }
  | { provider: 'facebook'; accessToken: string }
  | { provider: 'facebook'; authenticationToken: string; nonce: string }
  | { provider: 'apple'; identityToken: string; nonce: string; fullName?: string | undefined };

/**
 * A provider identity AFTER server-side verification (signature, issuer, audience, expiry, nonce). `subject` is the
 * provider's stable user id and the only identity key; `email` is an attribute that may be missing and is trusted for
 * account linking only when `emailVerified` is true.
 */
export interface VerifiedSocialIdentity {
  provider: SocialProvider;
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

/** Port implemented per provider (Google P2-04, Meta P2-05, Apple P2-06; a fake in tests). */
export interface SocialIdentityVerifier {
  /** Throws {@link SocialTokenInvalidError} for any token that fails verification. */
  verify(credentials: SocialCredentials): Promise<VerifiedSocialIdentity>;
}

/** The provider token failed verification. Carries no detail that could help an attacker probe. */
export class SocialTokenInvalidError extends Error {
  constructor() {
    super('Social token invalid');
    this.name = 'SocialTokenInvalidError';
  }
}

/** DI token: the verifiers that are enabled. A provider without an entry is not available. */
export const SOCIAL_VERIFIERS = Symbol('SOCIAL_VERIFIERS');
export type SocialVerifiers = Partial<Record<SocialProvider, SocialIdentityVerifier>>;

export type ProfileCompletionField = 'email' | 'phone';

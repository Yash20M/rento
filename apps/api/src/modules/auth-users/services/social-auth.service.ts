import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import { UniqueViolationError } from '../../../db/errors';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { withTransaction } from '../../../db/transaction';
import { UserRepository } from '../data/user.repository';
import {
  accountLinkRequired,
  socialProviderUnavailable,
  socialSignInDenied,
  socialTokenInvalid,
} from '../domain/auth-errors';
import {
  type ProfileCompletionField,
  SOCIAL_VERIFIERS,
  type SocialCredentials,
  SocialTokenInvalidError,
  type SocialVerifiers,
  type VerifiedSocialIdentity,
} from '../domain/social';
import { type AuthResult, AuthService } from './auth.service';

export interface SocialAuthResult extends AuthResult {
  needsProfileCompletion: ProfileCompletionField[];
}

type Resolution = { kind: 'user'; userId: string } | { kind: 'link_required' } | { kind: 'denied' };

/**
 * Turns a server-verified provider identity into a session (README §15.1, BR-19):
 * the identity key is (provider, subject); an email links accounts only when the provider verified it AND the
 * existing account's email is verified too; an untrusted email never merges and is never stored as the account email.
 */
@Injectable()
export class SocialAuthService {
  private readonly logger = new Logger(SocialAuthService.name);

  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(SOCIAL_VERIFIERS) private readonly verifiers: SocialVerifiers,
    private readonly users: UserRepository,
    private readonly auth: AuthService,
  ) {}

  async signIn(credentials: SocialCredentials): Promise<SocialAuthResult> {
    const identity = await this.verifyIdentity(credentials);
    const resolution = await this.resolveWithRetry(identity, credentials);

    if (resolution.kind === 'link_required') {
      this.logger.log(
        `social sign-in refused (provider=${identity.provider}, reason=link_required)`,
      );
      throw accountLinkRequired();
    }
    if (resolution.kind === 'denied') {
      this.logger.log(`social sign-in refused (provider=${identity.provider}, reason=denied)`);
      throw socialSignInDenied();
    }

    const session = await this.auth.createSession(resolution.userId);
    return {
      ...session,
      needsProfileCompletion: session.user.email === null ? ['email'] : [],
    };
  }

  /**
   * Runs the provider's verifier. 404 when the provider is not enabled, 401 `SOCIAL_TOKEN_INVALID` when the token is
   * refused; provider trouble surfaces as 503. Shared with identity linking (P2-07).
   */
  async verifyIdentity(credentials: SocialCredentials): Promise<VerifiedSocialIdentity> {
    const verifier = this.verifiers[credentials.provider];
    if (!verifier) throw socialProviderUnavailable();
    return this.verify(verifier.verify(credentials), credentials);
  }

  /** A verifier failure — or an answer for a different provider than asked — is a plain invalid token. */
  private async verify(
    pending: Promise<VerifiedSocialIdentity>,
    credentials: SocialCredentials,
  ): Promise<VerifiedSocialIdentity> {
    let identity: VerifiedSocialIdentity;
    try {
      identity = await pending;
    } catch (error) {
      if (error instanceof SocialTokenInvalidError) throw socialTokenInvalid();
      throw error;
    }
    if (identity.provider !== credentials.provider || identity.subject.trim() === '') {
      throw socialTokenInvalid();
    }
    const email = identity.email?.trim().toLowerCase() || null;
    return { ...identity, email, emailVerified: email !== null && identity.emailVerified };
  }

  /**
   * Concurrent first sign-ins race on the unique constraints (provider subject, user email, one identity per
   * provider and user). The loser's transaction is aborted by the database; running the resolution once more sees the
   * winner's rows and lands on sign-in, link or 409 as appropriate.
   */
  private async resolveWithRetry(
    identity: VerifiedSocialIdentity,
    credentials: SocialCredentials,
  ): Promise<Resolution> {
    try {
      return await withTransaction(this.db, (trx) => this.resolve(trx, identity, credentials));
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
      return withTransaction(this.db, (trx) => this.resolve(trx, identity, credentials));
    }
  }

  private async resolve(
    trx: Kysely<Database>,
    identity: VerifiedSocialIdentity,
    credentials: SocialCredentials,
  ): Promise<Resolution> {
    // 1. A known identity just signs in.
    const known = await this.users.findByIdentity(trx, identity.provider, identity.subject);
    if (known) {
      return known.status === 'active' ? { kind: 'user', userId: known.id } : { kind: 'denied' };
    }

    // 2./3. A new identity whose email matches an existing account.
    if (identity.email !== null) {
      const match = await this.users.findByEmail(trx, identity.email);
      if (match) {
        if (match.status !== 'active') return { kind: 'denied' };

        // Serialise linking per account. Without the lock, a concurrent sign-in with the same identity can commit
        // between the two reads below and make "already has a Google identity" look like a conflicting one.
        await this.users.lockUser(trx, match.id);
        const linkedMeanwhile = await this.users.findByIdentity(
          trx,
          identity.provider,
          identity.subject,
        );
        if (linkedMeanwhile) {
          return linkedMeanwhile.status === 'active'
            ? { kind: 'user', userId: linkedMeanwhile.id }
            : { kind: 'denied' };
        }

        const safeToLink =
          identity.emailVerified &&
          match.email_verified_at !== null &&
          !(await this.users.hasIdentity(trx, match.id, identity.provider));
        if (!safeToLink) return { kind: 'link_required' };

        await this.users.insertSocialIdentity(trx, {
          userId: match.id,
          provider: identity.provider,
          subject: identity.subject,
          email: identity.email,
          emailVerified: true,
        });
        if (identity.name) await this.users.fillDisplayName(trx, match.id, identity.name);
        return { kind: 'user', userId: match.id };
      }
    }

    // 4. A brand-new account. An unverified email stays on the identity only: storing it as the account email
    // would let anyone squat an address they do not own.
    const userId = randomUUID();
    const trusted = identity.emailVerified ? identity.email : null;
    const name =
      identity.name || (credentials.provider === 'apple' ? credentials.fullName?.trim() : null);
    await this.users.insertSocialUser(trx, {
      id: userId,
      email: trusted,
      emailVerifiedAt: trusted === null ? null : this.clock.now(),
      displayName: name || null,
    });
    await this.users.insertSocialIdentity(trx, {
      userId,
      provider: identity.provider,
      subject: identity.subject,
      email: identity.email,
      emailVerified: identity.emailVerified,
    });
    return { kind: 'user', userId };
  }
}

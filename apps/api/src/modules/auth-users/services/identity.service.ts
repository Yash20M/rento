import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/config.module';
import { UniqueViolationError } from '../../../db/errors';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { withTransaction } from '../../../db/transaction';
import { type IdentityRow, UserRepository } from '../data/user.repository';
import {
  accountUnavailable,
  identityInUse,
  identityNotLinked,
  lastLoginMethod,
  recentAuthenticationRequired,
} from '../domain/auth-errors';
import type { SocialCredentials } from '../domain/social';
import { SocialAuthService } from './social-auth.service';

export interface IdentityView {
  provider: string;
  email: string | null;
  emailVerified: boolean;
  linkedAt: Date;
}

const toView = (row: IdentityRow): IdentityView => ({
  provider: row.provider,
  email: row.provider_email,
  emailVerified: row.provider_email_verified,
  linkedAt: row.created_at,
});

/** Sign-in methods of the signed-in user (README §15.1 rules 2, 6; BR-19). Always the caller's own rows. */
@Injectable()
export class IdentityService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly users: UserRepository,
    private readonly social: SocialAuthService,
  ) {}

  async list(userId: string): Promise<IdentityView[]> {
    await this.requireActive(userId);
    return (await this.users.listIdentities(this.db, userId)).map(toView);
  }

  /**
   * Links a provider account. `signedInAt` (epoch seconds, the session's real sign-in time) must be recent — checked before anything is sent to the
   * provider. Idempotent for the identity the user already has.
   */
  async link(
    userId: string,
    signedInAt: number,
    credentials: SocialCredentials,
  ): Promise<IdentityView[]> {
    const ageSeconds = this.clock.now().getTime() / 1000 - signedInAt;
    if (ageSeconds > this.config.freshAuthMaxAgeSeconds) throw recentAuthenticationRequired();
    await this.requireActive(userId);

    const identity = await this.social.verifyIdentity(credentials);

    try {
      await withTransaction(this.db, async (trx) => {
        await this.users.lockUser(trx, userId);
        const owner = await this.users.findByIdentity(trx, identity.provider, identity.subject);
        if (owner) {
          if (owner.id === userId) return; // already linked: nothing to do
          throw identityInUse();
        }
        if (await this.users.hasIdentity(trx, userId, identity.provider)) throw identityInUse();
        await this.users.insertSocialIdentity(trx, {
          userId,
          provider: identity.provider,
          subject: identity.subject,
          email: identity.email,
          emailVerified: identity.emailVerified,
        });
      });
    } catch (error) {
      // Lost a race for the same provider account (or the same provider slot): the database constraint decides.
      if (error instanceof UniqueViolationError) throw identityInUse();
      throw error;
    }
    return (await this.users.listIdentities(this.db, userId)).map(toView);
  }

  async unlink(userId: string, provider: string): Promise<void> {
    await this.requireActive(userId);
    await withTransaction(this.db, async (trx) => {
      await this.users.lockUser(trx, userId); // two concurrent unlinks queue here, so the count below is exact
      const identities = await this.users.listIdentities(trx, userId);
      if (!identities.some((identity) => identity.provider === provider)) {
        throw identityNotLinked();
      }
      if (identities.length <= 1) throw lastLoginMethod();
      await this.users.deleteIdentity(trx, userId, provider);
    });
  }

  private async requireActive(userId: string): Promise<void> {
    const user = await this.users.findById(this.db, userId);
    if (!user || user.status !== 'active') throw accountUnavailable();
  }
}

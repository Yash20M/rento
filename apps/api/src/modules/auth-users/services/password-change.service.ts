import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import { AppError } from '../../../common/errors/app-error';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { withTransaction } from '../../../db/transaction';
import { RefreshTokenRepository } from '../data/refresh-token.repository';
import { UserRepository } from '../data/user.repository';
import { accountUnavailable, invalidCredentials, weakPassword } from '../domain/auth-errors';
import { passwordChangedEmail } from '../domain/mail-templates';
import { validatePassword } from '../domain/password-policy';
import { AuthMailService } from './auth-mail.service';
import { PasswordHasher } from './password-hasher';

/**
 * A signed-in person changes their own password: they must prove the current one, the new one must pass the same
 * policy as a reset and differ from the old one, and every session is signed out afterwards (the caller signs in again
 * with the new password). Accounts without a password (Google/Meta/Apple only) use "forgot password" to create one.
 */
@Injectable()
export class PasswordChangeService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly hasher: PasswordHasher,
    private readonly mail: AuthMailService,
  ) {}

  async change(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.users.findById(this.db, userId);
    if (!user || user.status !== 'active') throw accountUnavailable();

    const identity = await this.db
      .selectFrom('user_identities')
      .select('password_hash')
      .where('user_id', '=', userId)
      .where('provider', '=', 'password')
      .executeTakeFirst();
    const current = identity?.password_hash;
    if (!current) {
      throw new AppError({
        status: 409,
        code: 'INVALID_STATE',
        detail: 'This account has no password yet. Use "Forgot password" to create one',
      });
    }
    if (!(await this.hasher.verify(current, currentPassword))) throw invalidCredentials();

    const problems = validatePassword(newPassword, { email: user.email ?? '' });
    if (problems.length > 0) throw weakPassword(problems, 'newPassword');
    if (await this.hasher.verify(current, newPassword)) {
      throw weakPassword(['must be different from your current password'], 'newPassword');
    }
    const passwordHash = await this.hasher.hash(newPassword);

    const now = this.clock.now();
    await withTransaction(this.db, async (trx) => {
      await this.users.setPasswordHash(trx, userId, passwordHash, user.email ?? '');
      await this.refreshTokens.revokeAllForUser(trx, userId, now);
    });

    if (user.email) {
      const to = user.email;
      this.mail.background('password_changed', () =>
        this.mail.deliver(passwordChangedEmail({ to, name: user.display_name })),
      );
    }
  }
}

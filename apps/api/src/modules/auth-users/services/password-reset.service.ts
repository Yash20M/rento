import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/config.module';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { withTransaction } from '../../../db/transaction';
import { AuthTokenRepository } from '../data/auth-token.repository';
import { RefreshTokenRepository } from '../data/refresh-token.repository';
import { UserRepository } from '../data/user.repository';
import { invalidOneTimeToken, weakPassword } from '../domain/auth-errors';
import { passwordChangedEmail, passwordResetEmail } from '../domain/mail-templates';
import { MAIL_COOLDOWN_MS, generateOneTimeToken, hashOneTimeToken } from '../domain/one-time-token';
import { validatePassword } from '../domain/password-policy';
import { AuthMailService } from './auth-mail.service';
import { PasswordHasher } from './password-hasher';

const MINUTE_MS = 60 * 1000;
const PURPOSE = 'password_reset';

@Injectable()
export class PasswordResetService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly users: UserRepository,
    private readonly tokens: AuthTokenRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly hasher: PasswordHasher,
    private readonly mail: AuthMailService,
  ) {}

  /**
   * Runs in the background (see AuthMailService) so the endpoint answers the same way, at the same speed, for every
   * address. Only active accounts that have a password identity get a link; everything else is silently ignored.
   */
  async processRequest(email: string): Promise<void> {
    const user = await this.users.findByEmailWithPassword(this.db, email);
    if (!user || user.status !== 'active' || user.password_hash === null || user.email === null)
      return;

    const now = this.clock.now();
    const last = await this.tokens.latestCreatedAt(this.db, user.id, PURPOSE);
    if (last && now.getTime() - last.getTime() < MAIL_COOLDOWN_MS) return;

    const token = generateOneTimeToken();
    await this.tokens.issue(this.db, {
      userId: user.id,
      purpose: PURPOSE,
      email: user.email,
      tokenHash: hashOneTimeToken(token),
      expiresAt: new Date(now.getTime() + this.config.resetTokenTtlMinutes * MINUTE_MS),
      now,
    });
    await this.mail.deliver(
      passwordResetEmail({
        to: user.email,
        name: user.display_name,
        link: this.mail.link('/reset-password', token),
        ttlMinutes: this.config.resetTokenTtlMinutes,
      }),
    );
  }

  async reset(token: string, newPassword: string): Promise<void> {
    const tokenHash = hashOneTimeToken(token);

    // 1. Is the link usable at all? (Read-only, so a weak password below does not burn it.)
    const valid = await this.tokens.findValid(this.db, tokenHash, PURPOSE, this.clock.now());
    if (!valid) throw invalidOneTimeToken();

    // 2. Is the new password acceptable?
    const problems = validatePassword(newPassword, { email: valid.email });
    if (problems.length > 0) throw weakPassword(problems, 'newPassword');
    const passwordHash = await this.hasher.hash(newPassword); // slow work stays outside the transaction

    // 3. Consume the link and change everything atomically. Concurrent attempts: exactly one gets past `consume`.
    const now = this.clock.now();
    const userId = await withTransaction(this.db, async (trx) => {
      const consumed = await this.tokens.consume(trx, tokenHash, PURPOSE, now);
      if (!consumed) return undefined;
      await this.users.setPasswordHash(trx, consumed.userId, passwordHash, consumed.email);
      await this.users.markEmailVerified(trx, consumed.userId, now); // the link proved control of the address
      await this.refreshTokens.revokeAllForUser(trx, consumed.userId, now); // sign out everywhere
      await this.tokens.revokeOutstanding(trx, consumed.userId, PURPOSE, now);
      return consumed.userId;
    });
    if (userId === undefined) throw invalidOneTimeToken();

    const user = await this.users.findById(this.db, userId);
    if (user?.email) {
      this.mail.background('password_changed', () =>
        this.mail.deliver(
          passwordChangedEmail({ to: user.email as string, name: user.display_name }),
        ),
      );
    }
  }
}

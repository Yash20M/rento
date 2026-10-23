import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/config.module';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { UniqueViolationError } from '../../../db/errors';
import { withTransaction } from '../../../db/transaction';
import { AuthTokenRepository } from '../data/auth-token.repository';
import { UserRepository } from '../data/user.repository';
import { emailTaken, invalidOneTimeToken } from '../domain/auth-errors';
import { verificationEmail } from '../domain/mail-templates';
import { MAIL_COOLDOWN_MS, generateOneTimeToken, hashOneTimeToken } from '../domain/one-time-token';
import { AuthMailService } from './auth-mail.service';

const HOUR_MS = 60 * 60 * 1000;
const PURPOSE = 'email_verification';

@Injectable()
export class EmailVerificationService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly users: UserRepository,
    private readonly tokens: AuthTokenRepository,
    private readonly mail: AuthMailService,
  ) {}

  /**
   * Issues a fresh link (superseding older ones) and mails it. Does nothing when the account is gone, inactive,
   * has no email, is already verified, or a mail was sent less than a minute ago.
   */
  async issueAndSend(userId: string): Promise<void> {
    const user = await this.users.findById(this.db, userId);
    if (!user || user.status !== 'active' || user.email === null || user.email_verified_at !== null)
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
      expiresAt: new Date(now.getTime() + this.config.verificationTokenTtlHours * HOUR_MS),
      now,
    });
    await this.mail.deliver(
      verificationEmail({
        to: user.email,
        name: user.display_name,
        link: this.mail.link('/verify-email', token),
        ttlHours: this.config.verificationTokenTtlHours,
      }),
    );
  }

  /**
   * Mails a link that, once used, makes `email` the account's (verified) address. For accounts that have none yet
   * (social sign-ups): the address is only CLAIMED here — never written to the user — so nobody can squat an address
   * they do not own. The caller has already checked that no other account has it.
   */
  async issueForClaimedEmail(userId: string, email: string): Promise<void> {
    const user = await this.users.findById(this.db, userId);
    if (!user || user.status !== 'active' || user.email !== null) return;

    const now = this.clock.now();
    const last = await this.tokens.latestCreatedAt(this.db, user.id, PURPOSE);
    if (last && now.getTime() - last.getTime() < MAIL_COOLDOWN_MS) return;

    const token = generateOneTimeToken();
    await this.tokens.issue(this.db, {
      userId: user.id,
      purpose: PURPOSE,
      email,
      tokenHash: hashOneTimeToken(token),
      expiresAt: new Date(now.getTime() + this.config.verificationTokenTtlHours * HOUR_MS),
      now,
    });
    await this.mail.deliver(
      verificationEmail({
        to: email,
        name: user.display_name,
        link: this.mail.link('/verify-email', token),
        ttlHours: this.config.verificationTokenTtlHours,
      }),
    );
  }

  /** Consumes the link and marks the address verified (adopting it for accounts completing their profile). */
  async verify(token: string): Promise<void> {
    const now = this.clock.now();
    let consumed;
    try {
      consumed = await withTransaction(this.db, async (trx) => {
        const row = await this.tokens.consume(trx, hashOneTimeToken(token), PURPOSE, now);
        if (row) await this.users.markEmailVerified(trx, row.userId, now, row.email);
        return row;
      });
    } catch (error) {
      // The claimed address was registered by someone else in the meantime; the whole step rolled back.
      if (error instanceof UniqueViolationError) throw emailTaken();
      throw error;
    }
    if (!consumed) throw invalidOneTimeToken();
  }
}

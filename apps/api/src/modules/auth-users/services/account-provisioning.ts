import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { Clock } from '../../../common/clock/clock';
import type { AppConfig } from '../../../config/app-config';
import type { Database } from '../../../db/kysely';
import { AuthTokenRepository } from '../data/auth-token.repository';
import { type UserRow, UserRepository } from '../data/user.repository';
import { generateOneTimeToken, hashOneTimeToken } from '../domain/one-time-token';

const MINUTE_MS = 60_000;

export interface ProvisionedAccount {
  user: UserRow;
  /** False when the account already existed (e.g. an ordinary customer being promoted). */
  created: boolean;
}

/**
 * Account creation for staff, outside the public sign-up flow (Super Admin bootstrap CLI now, admin invitations in
 * P2-11). Plain class, not an injectable: the CLI has no Nest container. Every method takes the caller's
 * transaction, so the account, its role and its setup link commit — or roll back — together.
 */
export class AccountProvisioning {
  private readonly users = new UserRepository();
  private readonly tokens = new AuthTokenRepository();

  constructor(
    private readonly config: Pick<AppConfig, 'publicWebUrl' | 'resetTokenTtlMinutes'>,
    private readonly clock: Clock,
  ) {}

  async findByEmail(db: Kysely<Database>, email: string): Promise<UserRow | undefined> {
    return this.users.findByEmail(db, email);
  }

  /** The existing account for `email`, or a new password-less one (it cannot sign in until a setup link is used). */
  async ensureAccount(
    db: Kysely<Database>,
    input: { email: string; name?: string | undefined },
  ): Promise<ProvisionedAccount> {
    const existing = await this.users.findByEmail(db, input.email);
    if (existing) return { user: existing, created: false };

    const id = randomUUID();
    await this.users.insertSocialUser(db, {
      id,
      email: input.email,
      emailVerifiedAt: null, // proven when the setup link is used
      displayName: input.name ?? null,
    });
    const user = await this.users.findById(db, id);
    if (!user) throw new Error('account vanished after creation');
    return { user, created: true };
  }

  /**
   * A brand-new, ACTIVE account whose email is already verified (the mailed invitation proved control of it). Sign-in
   * is by password (`passwordHash`) or by a verified provider identity (`social`).
   */
  async createVerifiedAccount(
    db: Kysely<Database>,
    input: {
      email: string;
      name?: string | null | undefined;
      passwordHash?: string | undefined;
      social?: { provider: string; subject: string } | undefined;
    },
  ): Promise<string> {
    const id = randomUUID();
    const now = this.clock.now();
    await this.users.insertSocialUser(db, {
      id,
      email: input.email,
      emailVerifiedAt: now,
      displayName: input.name ?? null,
    });
    if (input.passwordHash !== undefined) {
      await this.users.insertPasswordIdentity(db, {
        userId: id,
        passwordHash: input.passwordHash,
        email: input.email,
      });
      await this.users.markEmailVerified(db, id, now);
    }
    if (input.social) {
      await this.users.insertSocialIdentity(db, {
        userId: id,
        provider: input.social.provider,
        subject: input.social.subject,
        email: input.email,
        emailVerified: true,
      });
    }
    return id;
  }

  hasPassword(db: Kysely<Database>, userId: string): Promise<boolean> {
    return this.users.hasIdentity(db, userId, 'password');
  }

  /**
   * One-time link to choose a password (the same single-use, hashed, expiring token as a password reset). Older
   * unused reset links of the user are revoked. Returns the link; the raw token exists nowhere else.
   */
  async issuePasswordSetupLink(
    db: Kysely<Database>,
    userId: string,
    email: string,
  ): Promise<{ link: string; expiresInMinutes: number }> {
    const now = this.clock.now();
    const token = generateOneTimeToken();
    await this.tokens.issue(db, {
      userId,
      purpose: 'password_reset',
      email,
      tokenHash: hashOneTimeToken(token),
      expiresAt: new Date(now.getTime() + this.config.resetTokenTtlMinutes * MINUTE_MS),
      now,
    });
    return {
      link: `${this.config.publicWebUrl}/reset-password?token=${encodeURIComponent(token)}`,
      expiresInMinutes: this.config.resetTokenTtlMinutes,
    };
  }
}

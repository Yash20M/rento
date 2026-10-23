import { randomUUID } from 'node:crypto';
import { RateLimitService } from '../../../common/rate-limit/rate-limit.service';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { mediaRef } from '../../../common/media/images';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/config.module';
import { UniqueViolationError } from '../../../db/errors';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { withTransaction } from '../../../db/transaction';
import { RefreshTokenRepository } from '../data/refresh-token.repository';
import { type UserRow, UserRepository } from '../data/user.repository';
import {
  emailTaken,
  invalidCredentials,
  invalidRefreshToken,
  weakPassword,
} from '../domain/auth-errors';
import { validatePassword } from '../domain/password-policy';
import { generateRefreshToken, hashRefreshToken } from '../domain/refresh-token';
import { AccessTokenService } from './access-token.service';
import { AuthMailService } from './auth-mail.service';
import { EmailVerificationService } from './email-verification.service';
import { PasswordHasher } from './password-hasher';

const DAY_MS = 24 * 60 * 60 * 1000;
const USERS_EMAIL_KEY = 'users_email_key';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: {
    id: string;
    email: string | null;
    displayName: string | null;
    emailVerified: boolean;
    avatarUrl: string | null;
  };
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  phone?: string | undefined;
}

type RefreshOutcome =
  | {
      kind: 'ok';
      user: UserRow;
      refreshToken: string;
      authTime: Date | undefined;
      mfaAt: Date | undefined;
    }
  | { kind: 'invalid' };

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  /** Verified against when the email is unknown, so unknown and known emails cost the same time. */
  private dummyHash = '';

  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly hasher: PasswordHasher,
    private readonly accessTokens: AccessTokenService,
    private readonly throttle: RateLimitService,
    private readonly mail: AuthMailService,
    private readonly emailVerification: EmailVerificationService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await this.hasher.hash(`dummy-${randomUUID()}`);
  }

  async register(input: RegisterInput): Promise<AuthResult> {
    const problems = validatePassword(input.password, { email: input.email });
    if (problems.length > 0) throw weakPassword(problems);

    const passwordHash = await this.hasher.hash(input.password); // slow work stays outside the transaction
    const userId = randomUUID();
    const now = this.clock.now();

    let refreshToken: string;
    try {
      refreshToken = await withTransaction(this.db, async (trx) => {
        await this.users.insertUser(trx, {
          id: userId,
          email: input.email,
          displayName: input.name,
          phone: input.phone ?? null,
        });
        await this.users.insertPasswordIdentity(trx, { userId, passwordHash, email: input.email });
        return this.startSession(trx, userId, now);
      });
    } catch (error) {
      if (error instanceof UniqueViolationError && error.constraint === USERS_EMAIL_KEY) {
        throw emailTaken();
      }
      throw error;
    }

    const user = await this.users.findById(this.db, userId);
    if (!user) throw new Error('user vanished after registration');
    // Mailed in the background: a slow or failing mail server must never break sign-up.
    this.mail.background('email_verification', () => this.emailVerification.issueAndSend(userId));
    return this.toResult(user, refreshToken);
  }

  async login(email: string, password: string, ip = 'unknown'): Promise<AuthResult> {
    // A locked pair is refused before any password work, even for the right password (no oracle for guessers).
    this.throttle.assertLoginAllowed(email, ip);
    const found = await this.users.findByEmailWithPassword(this.db, email);
    const hashToCheck = found?.password_hash ?? this.dummyHash;
    const passwordOk = await this.hasher.verify(hashToCheck, password);

    if (!found || !found.password_hash || !passwordOk || found.status !== 'active') {
      this.throttle.recordLoginFailure(email, ip);
      throw invalidCredentials();
    }
    this.throttle.recordLoginSuccess(email, ip);

    const refreshToken = await withTransaction(this.db, (trx) =>
      this.startSession(trx, found.id, this.clock.now()),
    );
    return this.toResult(found, refreshToken);
  }

  async refresh(presented: string): Promise<AuthResult> {
    const tokenHash = hashRefreshToken(presented);

    // Decide inside the transaction, throw outside it: a family revocation must COMMIT even though the
    // caller gets a 401.
    const outcome = await withTransaction(this.db, async (trx): Promise<RefreshOutcome> => {
      const row = await this.refreshTokens.findByHashForUpdate(trx, tokenHash);
      if (!row) return { kind: 'invalid' };
      const now = this.clock.now();

      if (row.revoked_at !== null) {
        if (row.replaced_by !== null) {
          // A rotated token came back: either a replayed request or a stolen token. Burn the whole family.
          await this.refreshTokens.revokeFamily(trx, row.family_id, now);
          this.logger.warn(
            `refresh token reuse detected: family=${row.family_id} user=${row.user_id}; family revoked`,
          );
        }
        return { kind: 'invalid' };
      }
      if (row.expires_at.getTime() <= now.getTime()) return { kind: 'invalid' };

      const user = await this.users.findById(trx, row.user_id);
      if (!user || user.status !== 'active') {
        await this.refreshTokens.revokeFamily(trx, row.family_id, now);
        return { kind: 'invalid' };
      }

      const next = generateRefreshToken();
      const inserted = await this.refreshTokens.insert(trx, {
        userId: row.user_id,
        familyId: row.family_id,
        tokenHash: hashRefreshToken(next),
        expiresAt: row.family_expires_at, // absolute lifetime: rotation never extends it
        familyExpiresAt: row.family_expires_at,
        createdAt: now,
        mfaVerifiedAt: row.mfa_verified_at,
      });
      await this.refreshTokens.markRotated(trx, row.id, inserted.id, now);
      // The new access token keeps the ORIGINAL sign-in time: a refresh is not a fresh authentication.
      const authTime = await this.refreshTokens.familyStartedAt(trx, row.family_id);
      return {
        kind: 'ok',
        user,
        refreshToken: next,
        authTime,
        mfaAt: row.mfa_verified_at ?? undefined,
      };
    });

    if (outcome.kind !== 'ok') throw invalidRefreshToken();
    return this.toResult(outcome.user, outcome.refreshToken, outcome.authTime, outcome.mfaAt);
  }

  /**
   * The person just proved the second step in this browser session (identified by its refresh token): remember it for
   * the session's later refreshes and hand out an access token that says so. Another person's or a dead token is refused.
   */
  async markSessionMfaVerified(
    userId: string,
    presented: string,
  ): Promise<{ token: string; expiresInSeconds: number }> {
    const now = this.clock.now();
    const row = await this.refreshTokens.findByHash(this.db, hashRefreshToken(presented));
    if (
      !row ||
      row.user_id !== userId ||
      row.revoked_at !== null ||
      row.expires_at.getTime() <= now.getTime()
    ) {
      throw invalidRefreshToken();
    }
    await this.refreshTokens.markFamilyMfaVerified(this.db, row.family_id, now);
    const authTime = await this.refreshTokens.familyStartedAt(this.db, row.family_id);
    return this.accessTokens.issue(userId, authTime, now);
  }

  /** Idempotent: unknown or already-revoked tokens succeed silently so nothing leaks. */
  async logout(presented: string): Promise<void> {
    const row = await this.refreshTokens.findByHash(this.db, hashRefreshToken(presented));
    if (!row) return;
    await this.refreshTokens.revokeFamily(this.db, row.family_id, this.clock.now());
  }

  /** Signs an already-authenticated, active user in (used after a verified social sign-in). */
  async createSession(userId: string): Promise<AuthResult> {
    const refreshToken = await withTransaction(this.db, (trx) =>
      this.startSession(trx, userId, this.clock.now()),
    );
    const user = await this.users.findById(this.db, userId);
    if (!user) throw new Error('user vanished during sign-in');
    return this.toResult(user, refreshToken);
  }

  /** Starts a new token family (one per login/registration) and returns its first refresh token. */
  private async startSession(trx: Kysely<Database>, userId: string, now: Date): Promise<string> {
    const token = generateRefreshToken();
    const familyExpiresAt = new Date(now.getTime() + this.config.refreshTokenTtlDays * DAY_MS);
    await this.refreshTokens.insert(trx, {
      userId,
      familyId: randomUUID(),
      tokenHash: hashRefreshToken(token),
      expiresAt: familyExpiresAt,
      familyExpiresAt,
      createdAt: now,
    });
    return token;
  }

  /** `authTime` = when the user actually signed in (defaults to now, i.e. a fresh sign-in). */
  private async toResult(
    user: UserRow,
    refreshToken: string,
    authTime?: Date,
    mfaAt?: Date,
  ): Promise<AuthResult> {
    const { token, expiresInSeconds } = await this.accessTokens.issue(user.id, authTime, mfaAt);
    return {
      accessToken: token,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: expiresInSeconds,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        emailVerified: user.email_verified_at !== null,
        avatarUrl: user.avatar_media_id ? mediaRef(user.avatar_media_id) : null,
      },
    };
  }
}

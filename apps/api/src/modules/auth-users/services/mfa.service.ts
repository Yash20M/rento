import { Inject, Injectable } from '@nestjs/common';
import { type Kysely, sql } from 'kysely';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import { AppError } from '../../../common/errors/app-error';
import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/config.module';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { withTransaction } from '../../../db/transaction';
import { UserRepository } from '../data/user.repository';
import {
  accountUnavailable,
  invalidCredentials,
  recentAuthenticationRequired,
} from '../domain/auth-errors';
import {
  RECOVERY_CODE_COUNT,
  base32Encode,
  decryptSecret,
  encryptSecret,
  hashRecoveryCode,
  matchingStep,
  newRecoveryCode,
  newSecret,
  otpauthUri,
} from '../domain/totp';
import { PasswordHasher } from './password-hasher';

export interface MfaStatus {
  enrolled: boolean;
  recoveryCodesLeft: number;
}

const wrongCode = (): AppError =>
  new AppError({
    status: 422,
    code: 'VALIDATION_FAILED',
    detail: 'Request validation failed',
    errors: [
      {
        field: 'code',
        message:
          'That code is not right. Check that your phone shows the right time and try again.',
      },
    ],
  });

const invalidState = (detail: string): AppError =>
  new AppError({ status: 409, code: 'INVALID_STATE', detail });

/**
 * Two-step verification for administrators (P4-05): an authenticator-app code (TOTP) plus single-use recovery codes.
 * Setting it up, changing it or turning it off first needs the person's password (or a very recent sign-in for accounts
 * without one) — a stolen session alone cannot lock the real owner out with a device of its own.
 */
@Injectable()
export class MfaService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  private get keyMaterial(): string {
    return this.config.mfaEncryptionKey ?? this.config.jwtSecret;
  }

  async status(userId: string): Promise<MfaStatus> {
    const totp = await this.db
      .selectFrom('user_mfa_totp')
      .select('confirmed_at')
      .where('user_id', '=', userId)
      .executeTakeFirst();
    const left = await this.db
      .selectFrom('user_mfa_recovery_codes')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .where('user_id', '=', userId)
      .where('used_at', 'is', null)
      .executeTakeFirstOrThrow();
    const enrolled = totp?.confirmed_at != null;
    return { enrolled, recoveryCodesLeft: enrolled ? Number(left.n) : 0 };
  }

  /** The password (or, without one, a recent sign-in) proves it is the owner, not just their session. */
  private async reauthenticate(
    userId: string,
    password: string | undefined,
    signedInAt: number,
  ): Promise<{ email: string }> {
    const user = await this.users.findById(this.db, userId);
    if (!user || user.status !== 'active') throw accountUnavailable();
    const identity = await this.db
      .selectFrom('user_identities')
      .select('password_hash')
      .where('user_id', '=', userId)
      .where('provider', '=', 'password')
      .executeTakeFirst();
    if (identity?.password_hash) {
      if (!password || !(await this.hasher.verify(identity.password_hash, password))) {
        throw invalidCredentials();
      }
    } else {
      const age = this.clock.now().getTime() / 1000 - signedInAt;
      if (age > this.config.freshAuthMaxAgeSeconds) throw recentAuthenticationRequired();
    }
    return { email: user.email ?? userId };
  }

  /** Starts setting up: a new secret that protects nothing until its first code is confirmed. */
  async beginEnrolment(
    userId: string,
    password: string | undefined,
    signedInAt: number,
  ): Promise<{ secret: string; otpauthUri: string }> {
    const { email } = await this.reauthenticate(userId, password, signedInAt);
    if ((await this.status(userId)).enrolled) {
      throw invalidState(
        'Two-step verification is already on. Turn it off first to set it up again',
      );
    }
    const secret = newSecret();
    await this.db
      .insertInto('user_mfa_totp')
      .values({
        user_id: userId,
        secret_enc: encryptSecret(secret, this.keyMaterial),
        confirmed_at: null,
        last_used_step: null,
      })
      .onConflict((oc) =>
        oc
          .column('user_id')
          .doUpdateSet({ secret_enc: encryptSecret(secret, this.keyMaterial), confirmed_at: null }),
      )
      .execute();
    return {
      secret: base32Encode(secret),
      otpauthUri: otpauthUri(this.config.mfaIssuer, email, secret),
    };
  }

  /** The first right code switches it on and returns the recovery codes — the only time they are ever shown. */
  async confirmEnrolment(userId: string, code: string): Promise<{ recoveryCodes: string[] }> {
    const now = this.clock.now();
    return withTransaction(this.db, async (trx) => {
      const row = await trx
        .selectFrom('user_mfa_totp')
        .selectAll()
        .where('user_id', '=', userId)
        .forUpdate()
        .executeTakeFirst();
      if (!row || row.confirmed_at !== null) {
        throw invalidState(
          'There is nothing to confirm. Start setting up two-step verification first',
        );
      }
      const step = matchingStep(decryptSecret(row.secret_enc, this.keyMaterial), code, now, null);
      if (step === undefined) throw wrongCode();
      await trx
        .updateTable('user_mfa_totp')
        .set({ confirmed_at: now, last_used_step: String(step) })
        .where('user_id', '=', userId)
        .execute();
      return { recoveryCodes: await this.replaceRecoveryCodes(trx, userId) };
    });
  }

  /** Checks a code from the authenticator app, or a recovery code (which is then used up). */
  async verify(
    userId: string,
    input: { code?: string | undefined; recoveryCode?: string | undefined },
  ): Promise<void> {
    const now = this.clock.now();
    await withTransaction(this.db, async (trx) => {
      const row = await trx
        .selectFrom('user_mfa_totp')
        .selectAll()
        .where('user_id', '=', userId)
        .where('confirmed_at', 'is not', null)
        .forUpdate()
        .executeTakeFirst();
      if (!row) throw invalidState('Two-step verification is not set up for this account');

      if (input.recoveryCode !== undefined && input.recoveryCode !== '') {
        const used = await trx
          .updateTable('user_mfa_recovery_codes')
          .set({ used_at: now })
          .where('user_id', '=', userId)
          .where('code_hash', '=', hashRecoveryCode(input.recoveryCode))
          .where('used_at', 'is', null)
          .returning('id')
          .executeTakeFirst();
        if (!used) throw wrongCode();
        return;
      }
      const last = row.last_used_step === null ? null : Number(row.last_used_step);
      const step = matchingStep(
        decryptSecret(row.secret_enc, this.keyMaterial),
        input.code ?? '',
        now,
        last,
      );
      if (step === undefined) throw wrongCode();
      await trx
        .updateTable('user_mfa_totp')
        .set({ last_used_step: String(step) })
        .where('user_id', '=', userId)
        .execute();
    });
  }

  /** New recovery codes replace every old one. Needs the password and a current code. */
  async regenerateRecoveryCodes(
    userId: string,
    password: string | undefined,
    code: string,
    signedInAt: number,
  ): Promise<{ recoveryCodes: string[] }> {
    await this.reauthenticate(userId, password, signedInAt);
    await this.verify(userId, { code });
    return withTransaction(this.db, async (trx) => ({
      recoveryCodes: await this.replaceRecoveryCodes(trx, userId),
    }));
  }

  /** Turns it off for yourself. Refused while the business requires it of every administrator. */
  async disable(
    userId: string,
    password: string | undefined,
    code: string,
    signedInAt: number,
  ): Promise<void> {
    await this.reauthenticate(userId, password, signedInAt);
    if (this.config.adminMfaRequired && (await this.holdsAnyRole(userId))) {
      throw invalidState(
        'Two-step verification is required for administrators and cannot be turned off',
      );
    }
    await this.verify(userId, { code });
    await withTransaction(this.db, (trx) => this.reset(trx, userId));
  }

  /**
   * Removes a person's two-step verification (their own switch-off, or an administrator helping after a lost phone) and
   * un-verifies every session of theirs. Runs inside the caller's transaction so it is audited together with the change.
   */
  async reset(trx: Kysely<Database>, userId: string): Promise<boolean> {
    const gone = await trx
      .deleteFrom('user_mfa_totp')
      .where('user_id', '=', userId)
      .returning('user_id')
      .executeTakeFirst();
    await trx.deleteFrom('user_mfa_recovery_codes').where('user_id', '=', userId).execute();
    await trx
      .updateTable('refresh_tokens')
      .set({ mfa_verified_at: null })
      .where('user_id', '=', userId)
      .execute();
    return gone !== undefined;
  }

  private async holdsAnyRole(userId: string): Promise<boolean> {
    const result = await sql<{ n: string }>`
      SELECT count(*) AS n FROM user_roles WHERE user_id = ${userId}`.execute(this.db);
    return Number(result.rows[0]?.n) > 0;
  }

  private async replaceRecoveryCodes(trx: Kysely<Database>, userId: string): Promise<string[]> {
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => newRecoveryCode());
    await trx.deleteFrom('user_mfa_recovery_codes').where('user_id', '=', userId).execute();
    await trx
      .insertInto('user_mfa_recovery_codes')
      .values(codes.map((code) => ({ user_id: userId, code_hash: hashRecoveryCode(code) })))
      .execute();
    return codes;
  }
}

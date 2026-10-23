import { createHmac } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { type Kysely, sql } from 'kysely';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import { AppError } from '../../../common/errors/app-error';
import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/config.module';
import { UniqueViolationError } from '../../../db/errors';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { type Tx, withTransaction } from '../../../db/transaction';
import { type Actor, AuditLog } from '../../reporting-audit';
import { isValidAadhaar, maskAadhaar, normalizeAadhaar } from '../domain/aadhaar';
import { IDENTITY_VERIFIER, type IdentityVerifier } from '../domain/identity-verifier';

const OTP_TTL_MS = 10 * 60_000;
const MAX_OTP_ATTEMPTS = 5;
const MAX_STARTS_PER_DAY = 5;
const DAY_MS = 86_400_000;

export type KycState = 'none' | 'pending' | 'verified' | 'rejected';

export interface KycView {
  required: boolean;
  status: KycState;
  /** `XXXX XXXX 1234`, when known. */
  maskedAadhaar: string | null;
  verifiedAt: Date | null;
  verifiedName: string | null;
  /** Why it was declined (staff decisions only). */
  reason: string | null;
}

const field = (name: string, message: string, status = 422): AppError =>
  new AppError({
    status,
    code: 'VALIDATION_FAILED',
    detail: 'Request validation failed',
    errors: [{ field: name, message }],
  });

export const kycRequired = (): AppError =>
  new AppError({
    status: 403,
    code: 'KYC_REQUIRED',
    detail: 'Verify your identity with your Aadhaar card before booking',
  });

/**
 * Aadhaar verification (owner decision 2026-10-18). The number is checked for typos, handed to the verification service
 * and DISCARDED: only the last four digits and a keyed hash are stored, so one card cannot back several accounts.
 */
@Injectable()
export class KycService {
  private readonly hashKey: Buffer;

  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(IDENTITY_VERIFIER) private readonly verifier: IdentityVerifier,
    private readonly audit: AuditLog,
  ) {
    this.hashKey = createHmac('sha256', config.jwtSecret).update('rento-kyc-aadhaar-hash').digest();
  }

  private hash(aadhaar: string): string {
    return createHmac('sha256', this.hashKey).update(aadhaar).digest('hex');
  }

  /** The customer's verification state. */
  async status(userId: string, db: Kysely<Database> = this.db): Promise<KycView> {
    const required = this.config.kycRequired;
    const row = await db
      .selectFrom('user_kyc')
      .selectAll()
      .where('user_id', '=', userId)
      .executeTakeFirst();
    if (row) {
      return {
        required,
        status: row.status as KycState,
        maskedAadhaar: row.aadhaar_last4 ? maskAadhaar(row.aadhaar_last4) : null,
        verifiedAt: row.verified_at,
        verifiedName: row.verified_name,
        reason: row.reason,
      };
    }
    const open = await db
      .selectFrom('kyc_requests')
      .select('aadhaar_last4')
      .where('user_id', '=', userId)
      .where('completed_at', 'is', null)
      .where('expires_at', '>', this.clock.now())
      .orderBy('created_at', 'desc')
      .executeTakeFirst();
    return {
      required,
      status: open ? 'pending' : 'none',
      maskedAadhaar: open ? maskAadhaar(open.aadhaar_last4) : null,
      verifiedAt: null,
      verifiedName: null,
      reason: null,
    };
  }

  /** Throws `403 KYC_REQUIRED` unless the customer may book. */
  async assertCanBook(userId: string, db: Kysely<Database>): Promise<void> {
    if (!this.config.kycRequired) return;
    const row = await db
      .selectFrom('user_kyc')
      .select('status')
      .where('user_id', '=', userId)
      .executeTakeFirst();
    if (row?.status !== 'verified') throw kycRequired();
  }

  async start(
    userId: string,
    rawNumber: string,
  ): Promise<{ requestId: string; expiresAt: Date; maskedAadhaar: string }> {
    const number = normalizeAadhaar(rawNumber);
    if (!isValidAadhaar(number)) {
      throw field(
        'aadhaarNumber',
        'enter the 12 digits of your Aadhaar number exactly as printed on the card',
      );
    }
    const now = this.clock.now();
    const state = await this.status(userId);
    if (state.status === 'verified') {
      throw new AppError({
        status: 409,
        code: 'INVALID_STATE',
        detail: 'Your identity is already verified',
      });
    }
    if (state.status === 'rejected') {
      throw new AppError({
        status: 409,
        code: 'INVALID_STATE',
        detail: 'Your verification was declined. Please contact support',
      });
    }
    const recent = await this.db
      .selectFrom('kyc_requests')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .where('user_id', '=', userId)
      .where('created_at', '>', new Date(now.getTime() - DAY_MS))
      .executeTakeFirstOrThrow();
    if (Number(recent.n) >= MAX_STARTS_PER_DAY) {
      throw new AppError({
        status: 429,
        code: 'RATE_LIMITED',
        detail: 'Too many verification attempts today. Please try again tomorrow',
      });
    }

    const hash = this.hash(number);
    const taken = await this.db
      .selectFrom('user_kyc')
      .select('user_id')
      .where('aadhaar_hash', '=', hash)
      .where('status', '=', 'verified')
      .where('user_id', '<>', userId)
      .executeTakeFirst();
    if (taken) {
      throw new AppError({
        status: 409,
        code: 'AADHAAR_IN_USE',
        detail: 'This Aadhaar is already verified on another account',
      });
    }

    const { providerRef } = await this.verifier.start({ aadhaarNumber: number });
    const request = await this.db
      .insertInto('kyc_requests')
      .values({
        user_id: userId,
        aadhaar_hash: hash,
        aadhaar_last4: number.slice(-4),
        provider: this.verifier.name,
        provider_ref: providerRef,
        expires_at: new Date(now.getTime() + OTP_TTL_MS),
        created_at: now,
      })
      .returning(['id', 'expires_at'])
      .executeTakeFirstOrThrow();
    return {
      requestId: request.id,
      expiresAt: request.expires_at,
      maskedAadhaar: maskAadhaar(number.slice(-4)),
    };
  }

  async verify(userId: string, requestId: string, otp: string): Promise<KycView> {
    const now = this.clock.now();
    const outcome = await withTransaction(this.db, async (trx) => {
      const request = await trx
        .selectFrom('kyc_requests')
        .selectAll()
        .where('id', '=', requestId)
        .where('user_id', '=', userId)
        .forUpdate()
        .executeTakeFirst();
      if (!request || request.completed_at)
        throw field('requestId', 'start the verification again', 404);
      if (request.expires_at <= now) throw field('otp', 'the code has expired; start again');
      if (request.otp_attempts >= MAX_OTP_ATTEMPTS) {
        throw new AppError({
          status: 429,
          code: 'RATE_LIMITED',
          detail: 'Too many wrong codes. Start the verification again',
        });
      }
      const result = await this.verifier.verify({ providerRef: request.provider_ref, otp });
      if (!result) {
        await trx
          .updateTable('kyc_requests')
          .set({ otp_attempts: sql`otp_attempts + 1` })
          .where('id', '=', requestId)
          .execute();
        return { wrong: MAX_OTP_ATTEMPTS - request.otp_attempts - 1 };
      }
      await this.saveVerified(trx, userId, request, result.name, now);
      return { wrong: undefined };
    }).catch((error: unknown) => {
      if (error instanceof UniqueViolationError && error.constraint === 'user_kyc_aadhaar_unique') {
        throw new AppError({
          status: 409,
          code: 'AADHAAR_IN_USE',
          detail: 'This Aadhaar is already verified on another account',
        });
      }
      throw error;
    });
    if (outcome.wrong !== undefined) {
      throw field('otp', `that code is not correct (${outcome.wrong} attempts left)`);
    }
    return this.status(userId);
  }

  private async saveVerified(
    trx: Tx,
    userId: string,
    request: {
      id: string;
      aadhaar_hash: string;
      aadhaar_last4: string;
      provider: string;
      provider_ref: string;
    },
    name: string,
    now: Date,
  ): Promise<void> {
    await trx
      .insertInto('user_kyc')
      .values({
        user_id: userId,
        status: 'verified',
        method: 'aadhaar_otp',
        aadhaar_last4: request.aadhaar_last4,
        aadhaar_hash: request.aadhaar_hash,
        verified_name: name,
        provider: request.provider,
        provider_ref: request.provider_ref,
        verified_at: now,
      })
      .onConflict((oc) =>
        oc.column('user_id').doUpdateSet({
          status: 'verified',
          method: 'aadhaar_otp',
          aadhaar_last4: request.aadhaar_last4,
          aadhaar_hash: request.aadhaar_hash,
          verified_name: name,
          provider: request.provider,
          provider_ref: request.provider_ref,
          verified_at: now,
          reason: null,
          decided_by: null,
        }),
      )
      .execute();
    await trx
      .updateTable('kyc_requests')
      .set({ completed_at: now })
      .where('id', '=', request.id)
      .execute();
    await this.audit.record(trx, {
      actor: { id: userId },
      action: 'kyc.verified',
      entityType: 'user',
      entityId: userId,
      after: { method: 'aadhaar_otp', last4: request.aadhaar_last4 },
    });
  }

  // ── staff decisions (P2-38) ──────────────────────────────────────────────────────────────────────
  async decide(
    actor: Actor,
    userId: string,
    decision: 'approve' | 'reject' | 'reset',
    reason: string,
  ): Promise<KycView> {
    const now = this.clock.now();
    await withTransaction(this.db, async (trx) => {
      const user = await trx
        .selectFrom('users')
        .select('id')
        .where('id', '=', userId)
        .forUpdate()
        .executeTakeFirst();
      if (!user)
        throw new AppError({ status: 404, code: 'NOT_FOUND', detail: 'Customer not found' });
      const before = await this.status(userId, trx);
      if (decision === 'reset') {
        await trx.deleteFrom('user_kyc').where('user_id', '=', userId).execute();
      } else {
        const status = decision === 'approve' ? 'verified' : 'rejected';
        await trx
          .insertInto('user_kyc')
          .values({
            user_id: userId,
            status,
            method: 'manual',
            decided_by: actor.id,
            reason,
            verified_at: decision === 'approve' ? now : null,
          })
          .onConflict((oc) =>
            oc.column('user_id').doUpdateSet({
              status,
              method: 'manual',
              aadhaar_last4: null,
              aadhaar_hash: null,
              verified_name: null,
              decided_by: actor.id,
              reason,
              verified_at: decision === 'approve' ? now : null,
            }),
          )
          .execute();
      }
      await this.audit.record(trx, {
        actor,
        action: `kyc.${decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'reset'}`,
        entityType: 'user',
        entityId: userId,
        before: { status: before.status },
        after: { decision },
        reason,
      });
    });
    return this.status(userId);
  }
}

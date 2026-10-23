import { Injectable } from '@nestjs/common';
import type { Selectable } from 'kysely';
import type { RefreshTokens } from '../../../db/generated/database';
import type { Db } from './user.repository';

export type RefreshTokenRow = Selectable<RefreshTokens>;

@Injectable()
export class RefreshTokenRepository {
  async insert(
    db: Db,
    row: {
      userId: string;
      familyId: string;
      tokenHash: string;
      expiresAt: Date;
      familyExpiresAt: Date;
      /** From the injected Clock (the family start doubles as the sign-in time, see `familyStartedAt`). */
      createdAt: Date;
      /** Carried over on rotation: the session keeps proving the second step it once proved. */
      mfaVerifiedAt?: Date | null;
    },
  ): Promise<RefreshTokenRow> {
    return db
      .insertInto('refresh_tokens')
      .values({
        user_id: row.userId,
        family_id: row.familyId,
        token_hash: row.tokenHash,
        expires_at: row.expiresAt,
        family_expires_at: row.familyExpiresAt,
        created_at: row.createdAt,
        mfa_verified_at: row.mfaVerifiedAt ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /** When the family's first token was issued = when the user actually signed in (rotation does not move it). */
  async familyStartedAt(db: Db, familyId: string): Promise<Date | undefined> {
    const row = await db
      .selectFrom('refresh_tokens')
      .select((eb) => eb.fn.min('created_at').as('started'))
      .where('family_id', '=', familyId)
      .executeTakeFirst();
    return row?.started ?? undefined;
  }

  /** Row-locks the token so concurrent refreshes of the same token serialize (exactly one can rotate it). */
  async findByHashForUpdate(db: Db, tokenHash: string): Promise<RefreshTokenRow | undefined> {
    return db
      .selectFrom('refresh_tokens')
      .selectAll()
      .where('token_hash', '=', tokenHash)
      .forUpdate()
      .executeTakeFirst();
  }

  async findByHash(db: Db, tokenHash: string): Promise<RefreshTokenRow | undefined> {
    return db
      .selectFrom('refresh_tokens')
      .selectAll()
      .where('token_hash', '=', tokenHash)
      .executeTakeFirst();
  }

  async markRotated(db: Db, id: string, replacedBy: string, now: Date): Promise<void> {
    await db
      .updateTable('refresh_tokens')
      .set({ revoked_at: now, replaced_by: replacedBy })
      .where('id', '=', id)
      .execute();
  }

  /** Records that this session just proved the second step (its live token carries it into every rotation). */
  async markFamilyMfaVerified(db: Db, familyId: string, at: Date): Promise<void> {
    await db
      .updateTable('refresh_tokens')
      .set({ mfa_verified_at: at })
      .where('family_id', '=', familyId)
      .where('revoked_at', 'is', null)
      .execute();
  }

  /** Revokes every still-live token of a family (logout, theft detection, deactivated user). */
  async revokeFamily(db: Db, familyId: string, now: Date): Promise<void> {
    await db
      .updateTable('refresh_tokens')
      .set({ revoked_at: now })
      .where('family_id', '=', familyId)
      .where('revoked_at', 'is', null)
      .execute();
  }

  /** Signs the user out everywhere: revokes every still-live token of every family. */
  async revokeAllForUser(db: Db, userId: string, now: Date): Promise<void> {
    await db
      .updateTable('refresh_tokens')
      .set({ revoked_at: now })
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .execute();
  }
}

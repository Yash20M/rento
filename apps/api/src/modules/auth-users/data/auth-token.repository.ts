import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import type { OneTimePurpose } from '../domain/one-time-token';
import type { Db } from './user.repository';

export interface ValidToken {
  userId: string;
  email: string;
}

/**
 * A token is valid iff it is unused, not superseded, unexpired, still addressed to the user's current email (or, for
 * email verification, the user has no email yet and the token carries the address they are completing), and the user
 * is active. Every query below encodes exactly that rule.
 */
@Injectable()
export class AuthTokenRepository {
  /** Supersedes earlier unused tokens of the same purpose, then stores the new one (hash only). */
  async issue(
    db: Db,
    token: {
      userId: string;
      purpose: OneTimePurpose;
      email: string;
      tokenHash: string;
      expiresAt: Date;
      now: Date;
    },
  ): Promise<void> {
    await this.revokeOutstanding(db, token.userId, token.purpose, token.now);
    await db
      .insertInto('auth_tokens')
      .values({
        user_id: token.userId,
        purpose: token.purpose,
        email: token.email,
        token_hash: token.tokenHash,
        expires_at: token.expiresAt,
        created_at: token.now,
      })
      .execute();
  }

  async revokeOutstanding(
    db: Db,
    userId: string,
    purpose: OneTimePurpose,
    now: Date,
  ): Promise<void> {
    await db
      .updateTable('auth_tokens')
      .set({ revoked_at: now })
      .where('user_id', '=', userId)
      .where('purpose', '=', purpose)
      .where('used_at', 'is', null)
      .where('revoked_at', 'is', null)
      .execute();
  }

  /** Read-only validity check (does not consume). */
  async findValid(
    db: Db,
    tokenHash: string,
    purpose: OneTimePurpose,
    now: Date,
  ): Promise<ValidToken | undefined> {
    const result = await sql<{ user_id: string; email: string }>`
      SELECT t.user_id, t.email
        FROM auth_tokens t JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = ${tokenHash} AND t.purpose = ${purpose}
         AND t.used_at IS NULL AND t.revoked_at IS NULL AND t.expires_at > ${now}
         AND (t.email = u.email OR (t.purpose = 'email_verification' AND u.email IS NULL))
         AND u.status = 'active'`.execute(db);
    const row = result.rows[0];
    return row ? { userId: row.user_id, email: row.email } : undefined;
  }

  /**
   * Atomically consumes a valid token. A single conditional UPDATE, so of any number of concurrent attempts exactly
   * one gets a row back (the others re-check the WHERE clause after the winner commits and match nothing).
   */
  async consume(
    db: Db,
    tokenHash: string,
    purpose: OneTimePurpose,
    now: Date,
  ): Promise<ValidToken | undefined> {
    const result = await sql<{ user_id: string; email: string }>`
      UPDATE auth_tokens t SET used_at = ${now}
        FROM users u
       WHERE u.id = t.user_id AND t.token_hash = ${tokenHash} AND t.purpose = ${purpose}
         AND t.used_at IS NULL AND t.revoked_at IS NULL AND t.expires_at > ${now}
         AND (t.email = u.email OR (t.purpose = 'email_verification' AND u.email IS NULL))
         AND u.status = 'active'
      RETURNING t.user_id, t.email`.execute(db);
    const row = result.rows[0];
    return row ? { userId: row.user_id, email: row.email } : undefined;
  }

  async latestCreatedAt(
    db: Db,
    userId: string,
    purpose: OneTimePurpose,
  ): Promise<Date | undefined> {
    const row = await db
      .selectFrom('auth_tokens')
      .select('created_at')
      .where('user_id', '=', userId)
      .where('purpose', '=', purpose)
      .orderBy('created_at', 'desc')
      .limit(1)
      .executeTakeFirst();
    return row?.created_at;
  }
}

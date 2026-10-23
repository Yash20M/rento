import { Injectable } from '@nestjs/common';
import { type Kysely, type Selectable, sql } from 'kysely';
import type { Database } from '../../../db/kysely';
import type { Users } from '../../../db/generated/database';

export type Db = Kysely<Database>;
export type UserRow = Selectable<Users>;

export interface IdentityRow {
  provider: string;
  provider_email: string | null;
  provider_email_verified: boolean;
  created_at: Date;
}

export interface UserWithPassword extends UserRow {
  password_hash: string | null;
}

@Injectable()
export class UserRepository {
  /** The user plus the hash of their password identity (null if they have none, e.g. social-only). */
  async findByEmailWithPassword(db: Db, email: string): Promise<UserWithPassword | undefined> {
    return db
      .selectFrom('users')
      .leftJoin('user_identities', (join) =>
        join
          .onRef('user_identities.user_id', '=', 'users.id')
          .on('user_identities.provider', '=', 'password'),
      )
      .selectAll('users')
      .select('user_identities.password_hash')
      .where('users.email', '=', email)
      .executeTakeFirst();
  }

  async findById(db: Db, id: string): Promise<UserRow | undefined> {
    return db.selectFrom('users').selectAll().where('id', '=', id).executeTakeFirst();
  }

  async insertUser(
    db: Db,
    user: { id: string; email: string; displayName: string; phone: string | null },
  ): Promise<void> {
    await db
      .insertInto('users')
      .values({ id: user.id, email: user.email, display_name: user.displayName, phone: user.phone })
      .execute();
  }

  async insertPasswordIdentity(
    db: Db,
    identity: { userId: string; passwordHash: string; email: string },
  ): Promise<void> {
    await db
      .insertInto('user_identities')
      .values({
        user_id: identity.userId,
        provider: 'password',
        provider_subject: identity.userId,
        password_hash: identity.passwordHash,
        provider_email: identity.email,
      })
      .execute();
  }

  /**
   * Marks the address as verified (idempotent: keeps the first verification time). `adoptEmail` completes a profile:
   * it becomes the account email only if the account has none (unique violation ⇒ someone else owns it now).
   */
  async markEmailVerified(db: Db, userId: string, now: Date, adoptEmail?: string): Promise<void> {
    await db
      .updateTable('users')
      .set({
        ...(adoptEmail !== undefined && { email: sql<string>`coalesce(email, ${adoptEmail})` }),
        email_verified_at: sql<Date>`coalesce(email_verified_at, ${now})`,
      })
      .where('id', '=', userId)
      .execute();
    await db
      .updateTable('user_identities')
      .set({ provider_email_verified: true })
      .where('user_id', '=', userId)
      .where('provider', '=', 'password')
      .execute();
  }

  /**
   * Sets the password, creating the password identity if the account has none yet (staff provisioned without one:
   * Super Admin bootstrap, invitations). Only a valid single-use reset/setup link ever reaches this.
   */
  async setPasswordHash(
    db: Db,
    userId: string,
    passwordHash: string,
    email: string,
  ): Promise<void> {
    await db
      .insertInto('user_identities')
      .values({
        user_id: userId,
        provider: 'password',
        provider_subject: userId,
        password_hash: passwordHash,
        provider_email: email,
      })
      .onConflict((oc) =>
        oc.columns(['user_id', 'provider']).doUpdateSet({ password_hash: passwordHash }),
      )
      .execute();
  }

  /** Any status: callers decide what a suspended or deleted match means. */
  async findByEmail(db: Db, email: string): Promise<UserRow | undefined> {
    return db.selectFrom('users').selectAll().where('email', '=', email).executeTakeFirst();
  }

  /** The user behind a provider identity, plus whether this user already has an identity for that provider. */
  async findByIdentity(db: Db, provider: string, subject: string): Promise<UserRow | undefined> {
    return db
      .selectFrom('user_identities')
      .innerJoin('users', 'users.id', 'user_identities.user_id')
      .selectAll('users')
      .where('user_identities.provider', '=', provider)
      .where('user_identities.provider_subject', '=', subject)
      .executeTakeFirst();
  }

  async hasIdentity(db: Db, userId: string, provider: string): Promise<boolean> {
    const row = await db
      .selectFrom('user_identities')
      .select('id')
      .where('user_id', '=', userId)
      .where('provider', '=', provider)
      .executeTakeFirst();
    return row !== undefined;
  }

  /** A user created by a social sign-in: no password identity, email only when the provider verified it. */
  async insertSocialUser(
    db: Db,
    user: {
      id: string;
      email: string | null;
      emailVerifiedAt: Date | null;
      displayName: string | null;
    },
  ): Promise<void> {
    await db
      .insertInto('users')
      .values({
        id: user.id,
        email: user.email,
        email_verified_at: user.emailVerifiedAt,
        display_name: user.displayName,
      })
      .execute();
  }

  async insertSocialIdentity(
    db: Db,
    identity: {
      userId: string;
      provider: string;
      subject: string;
      email: string | null;
      emailVerified: boolean;
    },
  ): Promise<void> {
    await db
      .insertInto('user_identities')
      .values({
        user_id: identity.userId,
        provider: identity.provider,
        provider_subject: identity.subject,
        provider_email: identity.email,
        provider_email_verified: identity.emailVerified,
      })
      .execute();
  }

  async fillDisplayName(db: Db, userId: string, name: string): Promise<void> {
    await db
      .updateTable('users')
      .set({ display_name: name })
      .where('id', '=', userId)
      .where('display_name', 'is', null)
      .execute();
  }

  /** Serialises changes to one user's sign-in methods (row lock held until the transaction ends). */
  async lockUser(db: Db, userId: string): Promise<UserRow | undefined> {
    return db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', userId)
      .forUpdate()
      .executeTakeFirst();
  }

  async listIdentities(db: Db, userId: string): Promise<IdentityRow[]> {
    return db
      .selectFrom('user_identities')
      .select(['provider', 'provider_email', 'provider_email_verified', 'created_at'])
      .where('user_id', '=', userId)
      .orderBy('created_at')
      .orderBy('provider')
      .execute();
  }

  /** True if a row was removed. */
  async deleteIdentity(db: Db, userId: string, provider: string): Promise<boolean> {
    const result = await db
      .deleteFrom('user_identities')
      .where('user_id', '=', userId)
      .where('provider', '=', provider)
      .executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  }

  async updateProfile(
    db: Db,
    userId: string,
    changes: { displayName?: string; phone?: string },
  ): Promise<void> {
    await db
      .updateTable('users')
      .set({
        ...(changes.displayName !== undefined && { display_name: changes.displayName }),
        ...(changes.phone !== undefined && { phone: changes.phone }),
        updated_at: sql<Date>`now()`,
      })
      .where('id', '=', userId)
      .execute();
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { type Kysely, sql } from 'kysely';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import { mediaRef } from '../../../common/media/images';
import { MediaStore } from '../../../common/media/media-store';
import { AppError } from '../../../common/errors/app-error';
import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/config.module';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { withTransaction } from '../../../db/transaction';
import { AuditLog } from '../../reporting-audit';
import { UserRepository } from '../data/user.repository';
import {
  accountUnavailable,
  invalidCredentials,
  recentAuthenticationRequired,
} from '../domain/auth-errors';
import { PasswordHasher } from './password-hasher';
import type { Profile } from './profile.service';

const LIVE = ['held', 'confirmed', 'active', 'overdue'];

/**
 * A person's own account: read it, and delete it (README §14.3, §15). Deleting keeps what the business must keep
 * (bookings, payments, refunds — the money trail) but removes everything that identifies the person, and signs every
 * session out. It is refused while a booking is still live, and for staff (manage them under Staff).
 */
@Injectable()
export class AccountLifecycleService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly audit: AuditLog,
    private readonly media: MediaStore,
  ) {}

  async get(userId: string): Promise<Profile> {
    const user = await this.users.findById(this.db, userId);
    if (!user || user.status !== 'active') throw accountUnavailable();
    return {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      phone: user.phone,
      emailVerified: user.email_verified_at !== null,
      avatarUrl: user.avatar_media_id ? mediaRef(user.avatar_media_id) : null,
      needsProfileCompletion: user.email === null ? ['email'] : [],
    };
  }

  /**
   * `password` proves it is really the owner for accounts that have one; accounts that sign in only with a provider
   * must have signed in recently instead (the same rule as linking a provider).
   */
  async deleteAccount(
    userId: string,
    ip: string,
    signedInAt: number,
    password: string | undefined,
  ): Promise<void> {
    await withTransaction(this.db, async (trx) => {
      await this.users.lockUser(trx, userId);
      const user = await this.users.findById(trx, userId);
      if (!user || user.status !== 'active') throw accountUnavailable();

      const own = await sql<{ password_hash: string | null }>`
        SELECT password_hash FROM user_identities WHERE user_id = ${userId} AND provider = 'password'`.execute(
        trx,
      );
      const hash = own.rows[0]?.password_hash;
      if (hash) {
        if (!password || !(await this.hasher.verify(hash, password))) throw invalidCredentials();
      } else {
        const age = this.clock.now().getTime() / 1000 - signedInAt;
        if (age > this.config.freshAuthMaxAgeSeconds) throw recentAuthenticationRequired();
      }

      const staff = await sql<{
        n: string;
      }>`SELECT count(*) AS n FROM user_roles WHERE user_id = ${userId}`.execute(trx);
      if (Number(staff.rows[0]?.n) > 0) {
        throw new AppError({
          status: 409,
          code: 'INVALID_STATE',
          detail:
            'A staff account cannot be deleted here. Ask an administrator to remove the roles first',
        });
      }
      const live = await sql<{ n: string }>`
        SELECT count(*) AS n FROM bookings WHERE user_id = ${userId} AND status = ANY(${sql.val(LIVE)}::text[])`.execute(
        trx,
      );
      if (Number(live.rows[0]?.n) > 0) {
        throw new AppError({
          status: 409,
          code: 'HAS_FUTURE_BOOKINGS',
          detail: 'Cancel or finish your current bookings first, then delete your account',
        });
      }

      const now = this.clock.now();
      await sql`UPDATE refresh_tokens SET revoked_at = ${now} WHERE user_id = ${userId} AND revoked_at IS NULL`.execute(
        trx,
      );
      await sql`DELETE FROM auth_tokens WHERE user_id = ${userId}`.execute(trx);
      await sql`DELETE FROM user_identities WHERE user_id = ${userId}`.execute(trx);
      await sql`DELETE FROM kyc_requests WHERE user_id = ${userId}`.execute(trx);
      await sql`DELETE FROM user_kyc WHERE user_id = ${userId}`.execute(trx);
      await sql`
        UPDATE users SET status = 'deleted', email = NULL, email_verified_at = NULL, phone = NULL,
                         display_name = NULL, avatar_media_id = NULL, updated_at = now()
         WHERE id = ${userId}`.execute(trx);
      // The picture identifies the person too: it goes with the account.
      await this.media.remove(trx, user.avatar_media_id);
      await this.audit.record(trx, {
        actor: { id: userId, ip },
        action: 'account.deleted',
        entityType: 'user',
        entityId: userId,
        before: { status: 'active' },
        after: { status: 'deleted' },
      });
    });
  }
}

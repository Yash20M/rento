import { Inject, Injectable } from '@nestjs/common';
import { type Kysely, sql } from 'kysely';
import { MAX_AVATAR_BYTES, mediaRef } from '../../../common/media/images';
import { MediaStore } from '../../../common/media/media-store';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { withTransaction } from '../../../db/transaction';
import { UserRepository } from '../data/user.repository';
import { accountUnavailable } from '../domain/auth-errors';

/** The signed-in person's profile photo (README §14.3). Replacing or removing one deletes the old bytes. */
@Injectable()
export class AvatarService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    private readonly users: UserRepository,
    private readonly media: MediaStore,
  ) {}

  /** @returns the address of the new picture (`/v1/media/<id>`). */
  async set(userId: string, bytes: unknown, claimedType: string): Promise<string> {
    const type = this.media.check('photo', bytes, claimedType, MAX_AVATAR_BYTES);
    return withTransaction(this.db, async (trx) => {
      await this.users.lockUser(trx, userId);
      const user = await this.users.findById(trx, userId);
      if (!user || user.status !== 'active') throw accountUnavailable();
      const id = await this.media.insert(trx, type, bytes as Buffer, userId);
      await sql`UPDATE users SET avatar_media_id = ${id}, updated_at = now() WHERE id = ${userId}`.execute(
        trx,
      );
      await this.media.remove(trx, user.avatar_media_id);
      return mediaRef(id);
    });
  }

  /** Idempotent. */
  async clear(userId: string): Promise<void> {
    await withTransaction(this.db, async (trx) => {
      await this.users.lockUser(trx, userId);
      const user = await this.users.findById(trx, userId);
      if (!user || user.status !== 'active') throw accountUnavailable();
      await sql`UPDATE users SET avatar_media_id = NULL, updated_at = now() WHERE id = ${userId}`.execute(
        trx,
      );
      await this.media.remove(trx, user.avatar_media_id);
    });
  }
}

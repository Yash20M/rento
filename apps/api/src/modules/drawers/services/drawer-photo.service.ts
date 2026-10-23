import { Inject, Injectable } from '@nestjs/common';
import { type Kysely, sql } from 'kysely';
import { MAX_IMAGE_BYTES } from '../../../common/media/images';
import { MediaStore } from '../../../common/media/media-store';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { withTransaction } from '../../../db/transaction';
import { type DrawerAccess, accessIncludes } from '../../access-control';
import { type Actor, AuditLog } from '../../reporting-audit';
import { DrawerRepository } from '../data/drawer.repository';
import { drawerNotFound } from '../domain/drawer-rules';

/** The cover photo of a drawer, set by staff who may change that drawer (`drawers:write`, within their scope). */
@Injectable()
export class DrawerPhotoService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    private readonly drawers: DrawerRepository,
    private readonly media: MediaStore,
    private readonly audit: AuditLog,
  ) {}

  async set(
    actor: Actor,
    access: DrawerAccess,
    drawerId: string,
    bytes: unknown,
    claimedType: string,
  ): Promise<void> {
    const type = this.media.check('photo', bytes, claimedType, MAX_IMAGE_BYTES);
    await withTransaction(this.db, async (trx) => {
      const drawer = await this.drawers.find(trx, drawerId);
      if (!drawer || !accessIncludes(access, drawerId)) throw drawerNotFound();
      const id = await this.media.insert(trx, type, bytes as Buffer, actor.id as string);
      await sql`UPDATE drawers SET photo_media_id = ${id} WHERE id = ${drawerId}`.execute(trx);
      await this.media.remove(trx, drawer.photo_media_id);
      await this.audit.record(trx, {
        actor,
        action: 'drawer.photo_set',
        entityType: 'drawer',
        entityId: drawerId,
        after: { photo: id, bytes: (bytes as Buffer).length },
      });
    });
  }

  async clear(actor: Actor, access: DrawerAccess, drawerId: string): Promise<void> {
    await withTransaction(this.db, async (trx) => {
      const drawer = await this.drawers.find(trx, drawerId);
      if (!drawer || !accessIncludes(access, drawerId)) throw drawerNotFound();
      if (!drawer.photo_media_id) return;
      await sql`UPDATE drawers SET photo_media_id = NULL WHERE id = ${drawerId}`.execute(trx);
      await this.media.remove(trx, drawer.photo_media_id);
      await this.audit.record(trx, {
        actor,
        action: 'drawer.photo_removed',
        entityType: 'drawer',
        entityId: drawerId,
        before: { photo: drawer.photo_media_id },
      });
    });
  }
}

import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { type Kysely, sql } from 'kysely';
import { AppError } from '../../../common/errors/app-error';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { withTransaction } from '../../../db/transaction';
import { type Actor, AuditLog } from '../../reporting-audit';
import { InventoryRepository, type ItemModelRow } from '../data/inventory.repository';
import { invalidField, itemModelNotFound } from '../domain/inventory-errors';
import {
  MAX_IMAGE_BYTES,
  MAX_PHOTOS_PER_MODEL,
  mediaIdOf,
  mediaRef,
  sniffImage,
} from '../domain/images';

export interface StoredImage {
  contentType: string;
  sha256: string;
  data: Buffer;
}

/**
 * Product photos uploaded by staff. The bytes are checked (real signature, size) before anything is stored, kept in
 * the `media` table and referenced from the item model as `/v1/media/<id>`.
 */
@Injectable()
export class ItemPhotoService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    private readonly inventory: InventoryRepository,
    private readonly audit: AuditLog,
  ) {}

  async add(
    actor: Actor,
    modelId: string,
    bytes: unknown,
    claimedType: string,
  ): Promise<ItemModelRow> {
    if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
      throw invalidField('photo', 'send the image file as the request body');
    }
    if (bytes.length > MAX_IMAGE_BYTES) {
      throw invalidField('photo', 'is larger than 5 MB');
    }
    const real = sniffImage(bytes);
    if (!real) throw invalidField('photo', 'must be a JPEG, PNG or WebP image');
    if (real !== claimedType) {
      throw invalidField('photo', 'does not match its declared type');
    }

    return withTransaction(this.db, async (trx) => {
      const model = await this.inventory.lockItemModel(trx, modelId);
      if (!model) throw itemModelNotFound();
      const photos = model.photos as string[];
      if (photos.length >= MAX_PHOTOS_PER_MODEL) {
        throw invalidField('photo', `a product can have at most ${MAX_PHOTOS_PER_MODEL} photos`);
      }
      const stored = await sql<{ id: string }>`
        INSERT INTO media (content_type, byte_size, sha256, data, uploaded_by)
        VALUES (${real}, ${bytes.length}, ${createHash('sha256').update(bytes).digest('hex')}, ${bytes}, ${actor.id})
        RETURNING id`.execute(trx);
      const ref = mediaRef(stored.rows[0]!.id);
      await this.inventory.updateItemModel(trx, modelId, {
        photos: JSON.stringify([...photos, ref]),
      });
      await this.audit.record(trx, {
        actor,
        action: 'item_model.photo_added',
        entityType: 'item_model',
        entityId: modelId,
        after: { photo: ref, bytes: bytes.length },
      });
      const after = await this.inventory.findItemModel(trx, modelId);
      if (!after) throw itemModelNotFound();
      return after;
    });
  }

  async remove(actor: Actor, modelId: string, mediaId: string): Promise<ItemModelRow> {
    return withTransaction(this.db, async (trx) => {
      const model = await this.inventory.lockItemModel(trx, modelId);
      if (!model) throw itemModelNotFound();
      const ref = mediaRef(mediaId.toLowerCase());
      const photos = model.photos as string[];
      if (!photos.includes(ref)) {
        throw new AppError({ status: 404, code: 'NOT_FOUND', detail: 'Photo not found' });
      }
      await this.inventory.updateItemModel(trx, modelId, {
        photos: JSON.stringify(photos.filter((p) => p !== ref)),
      });
      await sql`DELETE FROM media WHERE id = ${mediaId}`.execute(trx);
      await this.audit.record(trx, {
        actor,
        action: 'item_model.photo_removed',
        entityType: 'item_model',
        entityId: modelId,
        before: { photo: ref },
      });
      const after = await this.inventory.findItemModel(trx, modelId);
      if (!after) throw itemModelNotFound();
      return after;
    });
  }

  /** Photos dropped by an ordinary edit of the list no longer need their bytes. */
  async purgeUnreferenced(
    trx: Parameters<Parameters<typeof withTransaction>[1]>[0],
    before: readonly string[],
    after: readonly string[],
  ): Promise<void> {
    for (const ref of before) {
      const id = mediaIdOf(ref);
      if (id && !after.includes(ref)) await sql`DELETE FROM media WHERE id = ${id}`.execute(trx);
    }
  }

  async find(id: string): Promise<StoredImage | undefined> {
    const row = await sql<{ content_type: string; sha256: string; data: Buffer }>`
      SELECT content_type, sha256, data FROM media WHERE id = ${id}`.execute(this.db);
    const found = row.rows[0];
    return found && { contentType: found.content_type, sha256: found.sha256, data: found.data };
  }
}

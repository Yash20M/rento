import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import { AppError } from '../../../common/errors/app-error';
import { MAX_IMAGE_BYTES } from '../../../common/media/images';
import { MediaStore } from '../../../common/media/media-store';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { withTransaction } from '../../../db/transaction';
import { type Actor, AuditLog } from '../../reporting-audit';
import {
  PromotionRepository,
  type PromotionColumns,
  type PromotionRow,
  type PromotionView,
} from '../data/promotion.repository';
import { InventoryRepository } from '../data/inventory.repository';
import { invalidField } from '../domain/inventory-errors';
import { promotionWindowProblem } from '../domain/promotion-rules';

export const promotionNotFound = (): AppError =>
  new AppError({ status: 404, code: 'NOT_FOUND', detail: 'Banner not found' });

export interface PromotionInput {
  title: string;
  subtitle?: string | null | undefined;
  ctaLabel?: string | null | undefined;
  theme?: string | undefined;
  itemModelId?: string | null | undefined;
  /** ISO instants with a UTC offset, or `null`. */
  startsAt?: string | null | undefined;
  endsAt?: string | null | undefined;
  active?: boolean | undefined;
  sortOrder?: number | undefined;
}
export type PromotionPatch = Partial<PromotionInput>;

const asDate = (value: string | null | undefined): Date | null =>
  value === undefined || value === null ? null : new Date(value);

const snapshot = (p: PromotionRow) => ({
  title: p.title,
  subtitle: p.subtitle,
  ctaLabel: p.cta_label,
  theme: p.theme,
  itemModelId: p.item_model_id,
  startsAt: p.starts_at?.toISOString() ?? null,
  endsAt: p.ends_at?.toISOString() ?? null,
  active: p.active,
  sortOrder: p.sort_order,
  image: p.image_media_id,
});

/**
 * Home-screen banners, scheduled by staff who maintain the catalogue (`inventory:write`). A banner may open one product;
 * its picture lives in `media` like every other photo.
 */
@Injectable()
export class PromotionService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly promotions: PromotionRepository,
    private readonly inventory: InventoryRepository,
    private readonly media: MediaStore,
    private readonly audit: AuditLog,
  ) {}

  list(): Promise<PromotionView[]> {
    return this.promotions.list(this.db);
  }

  listLive(): Promise<PromotionView[]> {
    return this.promotions.listLive(this.db, this.clock.now());
  }

  async create(actor: Actor, input: PromotionInput): Promise<PromotionView> {
    const startsAt = asDate(input.startsAt);
    const endsAt = asDate(input.endsAt);
    const problem = promotionWindowProblem(startsAt, endsAt);
    if (problem) throw invalidField(problem.field, problem.message);
    const id = await withTransaction(this.db, async (trx) => {
      if (input.itemModelId && !(await this.inventory.findItemModel(trx, input.itemModelId))) {
        throw invalidField('itemModelId', 'no such product');
      }
      const created = await this.promotions.insert(trx, actor.id ?? null, {
        title: input.title,
        subtitle: input.subtitle ?? null,
        cta_label: input.ctaLabel ?? null,
        theme: input.theme ?? 'orange',
        item_model_id: input.itemModelId ?? null,
        starts_at: startsAt,
        ends_at: endsAt,
        active: input.active ?? true,
        sort_order: input.sortOrder ?? 0,
        image_media_id: null,
      });
      const row = (await this.promotions.lock(trx, created))!;
      await this.audit.record(trx, {
        actor,
        action: 'promotion.created',
        entityType: 'promotion',
        entityId: created,
        after: snapshot(row),
      });
      return created;
    });
    return (await this.promotions.find(this.db, id))!;
  }

  async update(actor: Actor, id: string, patch: PromotionPatch): Promise<PromotionView> {
    await withTransaction(this.db, async (trx) => {
      const before = await this.promotions.lock(trx, id);
      if (!before) throw promotionNotFound();
      const startsAt = patch.startsAt !== undefined ? asDate(patch.startsAt) : before.starts_at;
      const endsAt = patch.endsAt !== undefined ? asDate(patch.endsAt) : before.ends_at;
      const problem = promotionWindowProblem(startsAt, endsAt);
      if (problem) throw invalidField(problem.field, problem.message);
      if (patch.itemModelId && !(await this.inventory.findItemModel(trx, patch.itemModelId))) {
        throw invalidField('itemModelId', 'no such product');
      }
      const changes: Partial<PromotionColumns> = {
        ...(patch.title !== undefined && { title: patch.title }),
        ...(patch.subtitle !== undefined && { subtitle: patch.subtitle }),
        ...(patch.ctaLabel !== undefined && { cta_label: patch.ctaLabel }),
        ...(patch.theme !== undefined && { theme: patch.theme }),
        ...(patch.itemModelId !== undefined && { item_model_id: patch.itemModelId }),
        ...(patch.startsAt !== undefined && { starts_at: startsAt }),
        ...(patch.endsAt !== undefined && { ends_at: endsAt }),
        ...(patch.active !== undefined && { active: patch.active }),
        ...(patch.sortOrder !== undefined && { sort_order: patch.sortOrder }),
      };
      await this.promotions.update(trx, id, changes);
      await this.audit.record(trx, {
        actor,
        action: 'promotion.updated',
        entityType: 'promotion',
        entityId: id,
        before: snapshot(before),
        after: snapshot((await this.promotions.lock(trx, id))!),
      });
    });
    return (await this.promotions.find(this.db, id))!;
  }

  async remove(actor: Actor, id: string): Promise<void> {
    await withTransaction(this.db, async (trx) => {
      const before = await this.promotions.lock(trx, id);
      if (!before) throw promotionNotFound();
      await this.promotions.remove(trx, id);
      await this.media.remove(trx, before.image_media_id);
      await this.audit.record(trx, {
        actor,
        action: 'promotion.deleted',
        entityType: 'promotion',
        entityId: id,
        before: snapshot(before),
      });
    });
  }

  async setImage(
    actor: Actor,
    id: string,
    bytes: unknown,
    claimedType: string,
  ): Promise<PromotionView> {
    const type = this.media.check('image', bytes, claimedType, MAX_IMAGE_BYTES);
    await withTransaction(this.db, async (trx) => {
      const before = await this.promotions.lock(trx, id);
      if (!before) throw promotionNotFound();
      const mediaId = await this.media.insert(trx, type, bytes as Buffer, actor.id ?? null);
      await this.promotions.update(trx, id, { image_media_id: mediaId });
      await this.media.remove(trx, before.image_media_id);
      await this.audit.record(trx, {
        actor,
        action: 'promotion.image_set',
        entityType: 'promotion',
        entityId: id,
        after: { image: mediaId, bytes: (bytes as Buffer).length },
      });
    });
    return (await this.promotions.find(this.db, id))!;
  }

  async clearImage(actor: Actor, id: string): Promise<PromotionView> {
    await withTransaction(this.db, async (trx) => {
      const before = await this.promotions.lock(trx, id);
      if (!before) throw promotionNotFound();
      if (!before.image_media_id) return;
      await this.promotions.update(trx, id, { image_media_id: null });
      await this.media.remove(trx, before.image_media_id);
      await this.audit.record(trx, {
        actor,
        action: 'promotion.image_removed',
        entityType: 'promotion',
        entityId: id,
        before: { image: before.image_media_id },
      });
    });
    return (await this.promotions.find(this.db, id))!;
  }
}

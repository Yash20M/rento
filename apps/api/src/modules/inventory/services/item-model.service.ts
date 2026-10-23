import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import { AppError } from '../../../common/errors/app-error';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { withTransaction } from '../../../db/transaction';
import { type Actor, AuditLog } from '../../reporting-audit';
import { InventoryRepository, type ItemModelRow } from '../data/inventory.repository';
import { hasFutureBookings, invalidField, itemModelNotFound } from '../domain/inventory-errors';
import { modelRuleProblems } from '../domain/rules';
import { ItemPhotoService } from './item-photo.service';

export interface ItemModelInput {
  categoryId: string;
  name: string;
  description?: string | null | undefined;
  photos?: string[] | undefined;
  pricePerSlotPaise: number;
  slotMinutes: number;
  minDurationMin: number;
  maxDurationMin: number;
  bufferMin?: number | undefined;
  depositPaise?: number | undefined;
}

export type ItemModelPatch = Partial<Omit<ItemModelInput, 'description'>> & {
  description?: string | null | undefined;
  status?: 'active' | 'inactive' | undefined;
};

const snapshot = (m: ItemModelRow) => ({
  categoryId: m.category_id,
  name: m.name,
  description: m.description,
  photos: m.photos,
  pricePerSlotPaise: m.price_per_slot_paise,
  slotMinutes: m.slot_minutes,
  minDurationMin: m.min_duration_min,
  maxDurationMin: m.max_duration_min,
  bufferMin: m.buffer_min,
  depositPaise: m.deposit_paise,
  status: m.status,
});

const rulesError = (problems: Array<{ field: string; message: string }>): AppError =>
  new AppError({
    status: 422,
    code: 'VALIDATION_FAILED',
    detail: 'Request validation failed',
    errors: problems,
  });

/** Item models: what can be rented and under which pricing and slot rules (README §8.2, §9.7). Never hard-deleted. */
@Injectable()
export class ItemModelService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly inventory: InventoryRepository,
    private readonly audit: AuditLog,
    private readonly photoStore: ItemPhotoService,
  ) {}

  list(filter: { categoryId?: string | undefined; includeInactive: boolean }) {
    return this.inventory.listItemModels(this.db, filter);
  }

  async get(id: string): Promise<ItemModelRow> {
    const model = await this.inventory.findItemModel(this.db, id);
    if (!model) throw itemModelNotFound();
    return model;
  }

  async create(actor: Actor, input: ItemModelInput): Promise<ItemModelRow> {
    const problems = modelRuleProblems({
      slotMinutes: input.slotMinutes,
      minDurationMin: input.minDurationMin,
      maxDurationMin: input.maxDurationMin,
      bufferMin: input.bufferMin ?? 0,
    });
    if (problems.length > 0) throw rulesError(problems);

    return withTransaction(this.db, async (trx) => {
      if (!(await this.inventory.findCategory(trx, input.categoryId))) {
        throw invalidField('categoryId', 'no such category');
      }
      const created = await this.inventory.insertItemModel(trx, {
        categoryId: input.categoryId,
        name: input.name,
        description: input.description ?? null,
        photos: input.photos ?? [],
        pricePerSlotPaise: input.pricePerSlotPaise,
        slotMinutes: input.slotMinutes,
        minDurationMin: input.minDurationMin,
        maxDurationMin: input.maxDurationMin,
        bufferMin: input.bufferMin ?? 0,
        depositPaise: input.depositPaise ?? 0,
      });
      await this.audit.record(trx, {
        actor,
        action: 'item_model.created',
        entityType: 'item_model',
        entityId: created.id,
        after: snapshot(created),
      });
      return created;
    });
  }

  async update(actor: Actor, id: string, patch: ItemModelPatch): Promise<ItemModelRow> {
    return withTransaction(this.db, async (trx) => {
      const before = await this.inventory.lockItemModel(trx, id);
      if (!before) throw itemModelNotFound();

      const rules = {
        slotMinutes: patch.slotMinutes ?? before.slot_minutes,
        minDurationMin: patch.minDurationMin ?? before.min_duration_min,
        maxDurationMin: patch.maxDurationMin ?? before.max_duration_min,
        bufferMin: patch.bufferMin ?? before.buffer_min,
      };
      const problems = modelRuleProblems(rules);
      if (problems.length > 0) throw rulesError(problems);

      if (patch.categoryId && !(await this.inventory.findCategory(trx, patch.categoryId))) {
        throw invalidField('categoryId', 'no such category');
      }
      // Existing bookings keep the price and rules they were made with, but taking a model off the shelf while people
      // are still booked on it would strand them: refuse (README: deactivate with future bookings ⇒ 409).
      if (
        patch.status === 'inactive' &&
        before.status === 'active' &&
        (await this.inventory.futureBookingsForModel(trx, id, this.clock.now())) > 0
      ) {
        throw hasFutureBookings('This item model still has upcoming bookings');
      }

      await this.inventory.updateItemModel(trx, id, {
        ...(patch.categoryId !== undefined && { category_id: patch.categoryId }),
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.description !== undefined && { description: patch.description }),
        ...(patch.photos !== undefined && { photos: JSON.stringify(patch.photos) }),
        ...(patch.pricePerSlotPaise !== undefined && {
          price_per_slot_paise: patch.pricePerSlotPaise,
        }),
        ...(patch.slotMinutes !== undefined && { slot_minutes: patch.slotMinutes }),
        ...(patch.minDurationMin !== undefined && { min_duration_min: patch.minDurationMin }),
        ...(patch.maxDurationMin !== undefined && { max_duration_min: patch.maxDurationMin }),
        ...(patch.bufferMin !== undefined && { buffer_min: patch.bufferMin }),
        ...(patch.depositPaise !== undefined && { deposit_paise: patch.depositPaise }),
        ...(patch.status !== undefined && { status: patch.status }),
      });
      const after = await this.inventory.findItemModel(trx, id);
      if (!after) throw itemModelNotFound();
      if (patch.photos !== undefined) {
        await this.photoStore.purgeUnreferenced(
          trx,
          before.photos as string[],
          after.photos as string[],
        );
      }
      await this.audit.record(trx, {
        actor,
        action:
          patch.status && patch.status !== before.status
            ? `item_model.${patch.status === 'active' ? 'activated' : 'deactivated'}`
            : 'item_model.updated',
        entityType: 'item_model',
        entityId: id,
        before: snapshot(before),
        after: snapshot(after),
      });
      return after;
    });
  }
}

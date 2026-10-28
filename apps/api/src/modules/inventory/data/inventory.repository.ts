import { Injectable } from '@nestjs/common';
import { type Kysely, type Selectable, sql } from 'kysely';
import type { Assets, Categories, ItemModels } from '../../../db/generated/database';
import type { Database } from '../../../db/kysely';

type Db = Kysely<Database>;
export type CategoryRow = Selectable<Categories>;
export type ItemModelRow = Selectable<ItemModels>;
export type AssetRow = Selectable<Assets>;

export interface CategoryWithCount extends CategoryRow {
  item_model_count: number;
}
export interface AssetView extends AssetRow {
  item_model_name: string;
  drawer_name: string;
}

export interface AssetFilter {
  drawerIds: readonly string[] | 'all';
  drawerId?: string | undefined;
  itemModelId?: string | undefined;
  status?: string | undefined;
  q?: string | undefined;
}

@Injectable()
export class InventoryRepository {
  // ── categories ────────────────────────────────────────────────────────────────────────────────────
  async listCategories(db: Db): Promise<CategoryWithCount[]> {
    const rows = await db
      .selectFrom('categories')
      .leftJoin('item_models', 'item_models.category_id', 'categories.id')
      .selectAll('categories')
      .select((eb) => eb.fn.count<string>('item_models.id').as('item_model_count'))
      .groupBy('categories.id')
      .orderBy('categories.name')
      .execute();
    return rows.map((row) => ({ ...row, item_model_count: Number(row.item_model_count) }));
  }

  async findCategory(db: Db, id: string): Promise<CategoryRow | undefined> {
    return db.selectFrom('categories').selectAll().where('id', '=', id).executeTakeFirst();
  }

  async insertCategory(
    db: Db,
    category: { name: string; slug: string; parentId: string | null },
  ): Promise<CategoryRow> {
    return db
      .insertInto('categories')
      .values({ name: category.name, slug: category.slug, parent_id: category.parentId })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async updateCategory(
    db: Db,
    id: string,
    changes: { name?: string; slug?: string; parentId?: string | null },
  ): Promise<void> {
    await db
      .updateTable('categories')
      .set({
        ...(changes.name !== undefined && { name: changes.name }),
        ...(changes.slug !== undefined && { slug: changes.slug }),
        ...(changes.parentId !== undefined && { parent_id: changes.parentId }),
        updated_at: sql<Date>`now()`,
      })
      .where('id', '=', id)
      .execute();
  }

  async deleteCategory(db: Db, id: string): Promise<void> {
    await db.deleteFrom('categories').where('id', '=', id).execute();
  }

  async categoryDependants(db: Db, id: string): Promise<{ models: number; children: number }> {
    const models = await db
      .selectFrom('item_models')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .where('category_id', '=', id)
      .executeTakeFirstOrThrow();
    const children = await db
      .selectFrom('categories')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .where('parent_id', '=', id)
      .executeTakeFirstOrThrow();
    return { models: Number(models.n), children: Number(children.n) };
  }

  /** Would making `parentId` the parent of `id` create a cycle (it is `id` itself or one of its descendants)? */
  async wouldCycle(db: Db, id: string, parentId: string): Promise<boolean> {
    const result = await sql<{ found: boolean }>`
      WITH RECURSIVE descendants AS (
        SELECT id FROM categories WHERE id = ${id}
        UNION
        SELECT c.id FROM categories c JOIN descendants d ON c.parent_id = d.id
      )
      SELECT EXISTS (SELECT 1 FROM descendants WHERE id = ${parentId}) AS found`.execute(db);
    return result.rows[0]?.found === true;
  }

  // ── item models ───────────────────────────────────────────────────────────────────────────────────
  async listItemModels(
    db: Db,
    filter: { categoryId?: string | undefined; includeInactive: boolean },
  ): Promise<Array<ItemModelRow & { asset_count: number }>> {
    let query = db
      .selectFrom('item_models')
      .leftJoin('assets', (join) =>
        join
          .onRef('assets.item_model_id', '=', 'item_models.id')
          .on('assets.status', '<>', 'retired'),
      )
      .selectAll('item_models')
      .select((eb) => eb.fn.count<string>('assets.id').as('asset_count'))
      .groupBy('item_models.id')
      .orderBy('item_models.name');
    if (filter.categoryId) query = query.where('item_models.category_id', '=', filter.categoryId);
    if (!filter.includeInactive) query = query.where('item_models.status', '=', 'active');
    const rows = await query.execute();
    return rows.map((row) => ({ ...row, asset_count: Number(row.asset_count) }));
  }

  async findItemModel(db: Db, id: string): Promise<ItemModelRow | undefined> {
    return db.selectFrom('item_models').selectAll().where('id', '=', id).executeTakeFirst();
  }

  async lockItemModel(db: Db, id: string): Promise<ItemModelRow | undefined> {
    return db
      .selectFrom('item_models')
      .selectAll()
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst();
  }

  async insertItemModel(
    db: Db,
    model: {
      categoryId: string;
      name: string;
      description: string | null;
      photos: string[];
      pricePerSlotPaise: number;
      slotMinutes: number;
      minDurationMin: number;
      maxDurationMin: number;
      bufferMin: number;
      depositPaise: number;
      discountPercent: number | null;
      discountStartsAt: Date | null;
      discountEndsAt: Date | null;
      featured: boolean;
      /** From the injected clock, so "new" is judged on the same time as everything else. */
      createdAt: Date;
    },
  ): Promise<ItemModelRow> {
    return db
      .insertInto('item_models')
      .values({
        category_id: model.categoryId,
        name: model.name,
        description: model.description,
        photos: JSON.stringify(model.photos),
        price_per_slot_paise: model.pricePerSlotPaise,
        slot_minutes: model.slotMinutes,
        min_duration_min: model.minDurationMin,
        max_duration_min: model.maxDurationMin,
        buffer_min: model.bufferMin,
        deposit_paise: model.depositPaise,
        discount_percent: model.discountPercent,
        discount_starts_at: model.discountStartsAt,
        discount_ends_at: model.discountEndsAt,
        featured: model.featured,
        created_at: model.createdAt,
        updated_at: model.createdAt,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async updateItemModel(db: Db, id: string, changes: Partial<ItemModelColumns>): Promise<void> {
    await db
      .updateTable('item_models')
      .set({ ...changes, updated_at: sql<Date>`now()` })
      .where('id', '=', id)
      .execute();
  }

  /** Active bookings that still occupy this model's assets in the future. */
  async futureBookingsForModel(db: Db, modelId: string, now: Date): Promise<number> {
    const row = await db
      .selectFrom('bookings')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .where('item_model_id', '=', modelId)
      .where('status', 'in', ['held', 'confirmed', 'active', 'overdue'])
      .where('ends_at', '>', now)
      .executeTakeFirstOrThrow();
    return Number(row.n);
  }

  async assetCountForModel(db: Db, modelId: string): Promise<number> {
    const row = await db
      .selectFrom('assets')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .where('item_model_id', '=', modelId)
      .executeTakeFirstOrThrow();
    return Number(row.n);
  }

  // ── assets ────────────────────────────────────────────────────────────────────────────────────────
  private assetQuery(db: Db) {
    return db
      .selectFrom('assets')
      .innerJoin('item_models', 'item_models.id', 'assets.item_model_id')
      .innerJoin('drawers', 'drawers.id', 'assets.drawer_id')
      .selectAll('assets')
      .select(['item_models.name as item_model_name', 'drawers.name as drawer_name']);
  }

  async listAssets(
    db: Db,
    filter: AssetFilter,
    page: { limit: number; after?: string | undefined },
  ): Promise<AssetView[]> {
    let query = this.assetQuery(db)
      .orderBy('assets.asset_code')
      .limit(page.limit + 1);
    if (filter.drawerIds !== 'all') {
      if (filter.drawerIds.length === 0) return [];
      query = query.where('assets.drawer_id', 'in', filter.drawerIds);
    }
    if (filter.drawerId) query = query.where('assets.drawer_id', '=', filter.drawerId);
    if (filter.itemModelId) query = query.where('assets.item_model_id', '=', filter.itemModelId);
    if (filter.status) query = query.where('assets.status', '=', filter.status);
    if (filter.q)
      query = query.where('assets.asset_code', 'ilike', `%${filter.q.replace(/[%_\\]/g, '\\$&')}%`);
    if (page.after) query = query.where('assets.asset_code', '>', page.after);
    return query.execute();
  }

  async findAsset(db: Db, id: string): Promise<AssetView | undefined> {
    return this.assetQuery(db).where('assets.id', '=', id).executeTakeFirst();
  }

  async lockAsset(db: Db, id: string): Promise<AssetRow | undefined> {
    return db.selectFrom('assets').selectAll().where('id', '=', id).forUpdate().executeTakeFirst();
  }

  async insertAsset(
    db: Db,
    asset: { assetCode: string; itemModelId: string; drawerId: string; serialNo: string | null },
  ): Promise<AssetRow> {
    return db
      .insertInto('assets')
      .values({
        asset_code: asset.assetCode,
        item_model_id: asset.itemModelId,
        drawer_id: asset.drawerId,
        serial_no: asset.serialNo,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async updateAsset(
    db: Db,
    id: string,
    changes: { serialNo?: string | null; status?: string },
  ): Promise<void> {
    await db
      .updateTable('assets')
      .set({
        ...(changes.serialNo !== undefined && { serial_no: changes.serialNo }),
        ...(changes.status !== undefined && { status: changes.status }),
        updated_at: sql<Date>`now()`,
      })
      .where('id', '=', id)
      .execute();
  }

  /** Occupancies (bookings, blocks) of the asset that have not ended and are not released. */
  async futureOccupancies(db: Db, assetId: string, now: Date): Promise<number> {
    const row = await db
      .selectFrom('asset_occupancies')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .where('asset_id', '=', assetId)
      .where('released_at', 'is', null)
      .where(sql<boolean>`upper(during) > ${now}`)
      .executeTakeFirstOrThrow();
    return Number(row.n);
  }
}

export interface ItemModelColumns {
  category_id: string;
  name: string;
  description: string | null;
  photos: string;
  price_per_slot_paise: number;
  slot_minutes: number;
  min_duration_min: number;
  max_duration_min: number;
  buffer_min: number;
  deposit_paise: number;
  status: string;
}

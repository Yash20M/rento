import { Injectable } from '@nestjs/common';
import { type Kysely, type Selectable, sql } from 'kysely';
import type { Promotions } from '../../../db/generated/database';
import type { Database } from '../../../db/kysely';

type Db = Kysely<Database>;
export type PromotionRow = Selectable<Promotions>;
export interface PromotionView extends PromotionRow {
  item_model_name: string | null;
  item_model_status: string | null;
}

export interface PromotionColumns {
  title: string;
  subtitle: string | null;
  cta_label: string | null;
  theme: string;
  item_model_id: string | null;
  starts_at: Date | null;
  ends_at: Date | null;
  active: boolean;
  sort_order: number;
  image_media_id: string | null;
}

@Injectable()
export class PromotionRepository {
  private base(db: Db) {
    return db
      .selectFrom('promotions')
      .leftJoin('item_models', 'item_models.id', 'promotions.item_model_id')
      .selectAll('promotions')
      .select(['item_models.name as item_model_name', 'item_models.status as item_model_status'])
      .orderBy('promotions.sort_order')
      .orderBy('promotions.created_at')
      .orderBy('promotions.id');
  }

  list(db: Db): Promise<PromotionView[]> {
    return this.base(db).execute();
  }

  /** The banners customers may see at [now]: switched on, begun and not yet ended. */
  listLive(db: Db, now: Date): Promise<PromotionView[]> {
    return this.base(db)
      .where('promotions.active', '=', true)
      .where((eb) =>
        eb.or([eb('promotions.starts_at', 'is', null), eb('promotions.starts_at', '<=', now)]),
      )
      .where((eb) =>
        eb.or([eb('promotions.ends_at', 'is', null), eb('promotions.ends_at', '>', now)]),
      )
      .execute();
  }

  find(db: Db, id: string): Promise<PromotionView | undefined> {
    return this.base(db).where('promotions.id', '=', id).executeTakeFirst();
  }

  async lock(db: Db, id: string): Promise<PromotionRow | undefined> {
    return db
      .selectFrom('promotions')
      .selectAll()
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst();
  }

  async insert(db: Db, createdBy: string | null, c: PromotionColumns): Promise<string> {
    const row = await db
      .insertInto('promotions')
      .values({ ...c, created_by: createdBy })
      .returning('id')
      .executeTakeFirstOrThrow();
    return row.id;
  }

  async update(db: Db, id: string, changes: Partial<PromotionColumns>): Promise<void> {
    await db
      .updateTable('promotions')
      .set({ ...changes, updated_at: sql<Date>`now()` })
      .where('id', '=', id)
      .execute();
  }

  async remove(db: Db, id: string): Promise<void> {
    await db.deleteFrom('promotions').where('id', '=', id).execute();
  }
}

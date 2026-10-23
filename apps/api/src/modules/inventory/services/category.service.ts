import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { UniqueViolationError } from '../../../db/errors';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { withTransaction } from '../../../db/transaction';
import { type Actor, AuditLog } from '../../reporting-audit';
import {
  type CategoryRow,
  type CategoryWithCount,
  InventoryRepository,
} from '../data/inventory.repository';
import { alreadyExists, categoryNotFound, inUse, invalidField } from '../domain/inventory-errors';
import { SLUG_PATTERN, slugify } from '../domain/rules';

const SLUG_KEY = 'categories_slug_key';

const snapshot = (c: CategoryRow) => ({ name: c.name, slug: c.slug, parentId: c.parent_id });

@Injectable()
export class CategoryService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    private readonly inventory: InventoryRepository,
    private readonly audit: AuditLog,
  ) {}

  list(): Promise<CategoryWithCount[]> {
    return this.inventory.listCategories(this.db);
  }

  async create(
    actor: Actor,
    input: { name: string; slug?: string | undefined; parentId?: string | null | undefined },
  ): Promise<CategoryRow> {
    const slug = input.slug ?? slugify(input.name);
    if (!SLUG_PATTERN.test(slug))
      throw invalidField('slug', 'use lower-case letters, digits and single hyphens');
    try {
      return await withTransaction(this.db, async (trx) => {
        if (input.parentId && !(await this.inventory.findCategory(trx, input.parentId))) {
          throw invalidField('parentId', 'no such category');
        }
        const created = await this.inventory.insertCategory(trx, {
          name: input.name,
          slug,
          parentId: input.parentId ?? null,
        });
        await this.audit.record(trx, {
          actor,
          action: 'category.created',
          entityType: 'category',
          entityId: created.id,
          after: snapshot(created),
        });
        return created;
      });
    } catch (error) {
      throw this.translate(error);
    }
  }

  async update(
    actor: Actor,
    id: string,
    input: {
      name?: string | undefined;
      slug?: string | undefined;
      parentId?: string | null | undefined;
    },
  ): Promise<CategoryRow> {
    if (input.slug !== undefined && !SLUG_PATTERN.test(input.slug)) {
      throw invalidField('slug', 'use lower-case letters, digits and single hyphens');
    }
    try {
      return await withTransaction(this.db, async (trx) => {
        const before = await this.inventory.findCategory(trx, id);
        if (!before) throw categoryNotFound();
        if (input.parentId) {
          if (!(await this.inventory.findCategory(trx, input.parentId))) {
            throw invalidField('parentId', 'no such category');
          }
          if (await this.inventory.wouldCycle(trx, id, input.parentId)) {
            throw invalidField('parentId', 'a category cannot be inside itself');
          }
        }
        await this.inventory.updateCategory(trx, id, {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.slug !== undefined && { slug: input.slug }),
          ...(input.parentId !== undefined && { parentId: input.parentId }),
        });
        const after = await this.inventory.findCategory(trx, id);
        if (!after) throw categoryNotFound();
        await this.audit.record(trx, {
          actor,
          action: 'category.updated',
          entityType: 'category',
          entityId: id,
          before: snapshot(before),
          after: snapshot(after),
        });
        return after;
      });
    } catch (error) {
      throw this.translate(error);
    }
  }

  async remove(actor: Actor, id: string): Promise<void> {
    await withTransaction(this.db, async (trx) => {
      const before = await this.inventory.findCategory(trx, id);
      if (!before) throw categoryNotFound();
      const dependants = await this.inventory.categoryDependants(trx, id);
      if (dependants.models > 0 || dependants.children > 0) {
        throw inUse('This category still contains item models or sub-categories');
      }
      await this.inventory.deleteCategory(trx, id);
      await this.audit.record(trx, {
        actor,
        action: 'category.deleted',
        entityType: 'category',
        entityId: id,
        before: snapshot(before),
      });
    });
  }

  private translate(error: unknown): unknown {
    if (error instanceof UniqueViolationError && error.constraint === SLUG_KEY) {
      return alreadyExists('slug', 'a category with this slug already exists');
    }
    return error;
  }
}

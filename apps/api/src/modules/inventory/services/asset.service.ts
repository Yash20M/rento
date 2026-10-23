import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import { UniqueViolationError } from '../../../db/errors';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { withTransaction } from '../../../db/transaction';
import { AppError } from '../../../common/errors/app-error';
import { type DrawerAccess, accessIncludes as canAccessDrawerIn } from '../../access-control';
import { type Actor, AuditLog } from '../../reporting-audit';
import { type AssetView, InventoryRepository } from '../data/inventory.repository';
import {
  alreadyExists,
  assetNotFound,
  hasFutureBookings,
  invalidField,
  invalidTransition,
} from '../domain/inventory-errors';
import { type AssetStatus, canTransition, needsNoFutureBookings } from '../domain/rules';

const CODE_KEY = 'assets_asset_code_key';

const snapshot = (a: AssetView) => ({
  assetCode: a.asset_code,
  itemModelId: a.item_model_id,
  drawerId: a.drawer_id,
  serialNo: a.serial_no,
  status: a.status,
});

const denied = (): AppError =>
  new AppError({
    status: 403,
    code: 'PERMISSION_DENIED',
    detail: 'You do not have permission for this drawer',
  });

export interface AssetPage {
  items: AssetView[];
  nextCursor: string | null;
}

/** The physical assets in the drawers. Admins limited to some drawers only see and change those (README §13.5). */
@Injectable()
export class AssetService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly inventory: InventoryRepository,
    private readonly audit: AuditLog,
  ) {}

  async list(
    access: DrawerAccess,
    filter: { drawerId?: string; itemModelId?: string; status?: string; q?: string },
    page: { limit: number; cursor?: string | undefined },
  ): Promise<AssetPage> {
    if (access.kind === 'none') return { items: [], nextCursor: null };
    const after = page.cursor ? decodeCursor(page.cursor) : undefined;
    const rows = await this.inventory.listAssets(
      this.db,
      { drawerIds: access.kind === 'all' ? 'all' : access.ids, ...filter },
      { limit: page.limit, after },
    );
    const items = rows.slice(0, page.limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor: rows.length > page.limit && last ? encodeCursor(last.asset_code) : null,
    };
  }

  async get(access: DrawerAccess, id: string): Promise<AssetView> {
    const asset = await this.inventory.findAsset(this.db, id);
    // An asset in a drawer outside the caller's scope is indistinguishable from a missing one.
    if (!asset || !canAccessDrawerIn(access, asset.drawer_id)) throw assetNotFound();
    return asset;
  }

  async create(
    actor: Actor,
    access: DrawerAccess,
    input: {
      assetCode: string;
      itemModelId: string;
      drawerId: string;
      serialNo?: string | null | undefined;
    },
  ): Promise<AssetView> {
    if (!canAccessDrawerIn(access, input.drawerId)) throw denied();
    try {
      return await withTransaction(this.db, async (trx) => {
        const model = await this.inventory.findItemModel(trx, input.itemModelId);
        if (!model) throw invalidField('itemModelId', 'no such item model');
        if (model.status !== 'active')
          throw invalidField('itemModelId', 'this item model is inactive');
        const drawer = await trx
          .selectFrom('drawers')
          .select('id')
          .where('id', '=', input.drawerId)
          .executeTakeFirst();
        if (!drawer) throw invalidField('drawerId', 'no such drawer');

        const row = await this.inventory.insertAsset(trx, {
          assetCode: input.assetCode,
          itemModelId: input.itemModelId,
          drawerId: input.drawerId,
          serialNo: input.serialNo ?? null,
        });
        const created = await this.inventory.findAsset(trx, row.id);
        if (!created) throw assetNotFound();
        await this.audit.record(trx, {
          actor,
          action: 'asset.created',
          entityType: 'asset',
          entityId: row.id,
          after: snapshot(created),
        });
        return created;
      });
    } catch (error) {
      if (error instanceof UniqueViolationError && error.constraint === CODE_KEY) {
        throw alreadyExists('assetCode', 'an asset with this code already exists');
      }
      throw error;
    }
  }

  async update(
    actor: Actor,
    access: DrawerAccess,
    id: string,
    patch: { serialNo?: string | null | undefined; status?: AssetStatus | undefined },
  ): Promise<AssetView> {
    return withTransaction(this.db, async (trx) => {
      const locked = await this.inventory.lockAsset(trx, id);
      if (!locked || !canAccessDrawerIn(access, locked.drawer_id)) throw assetNotFound();
      const before = await this.inventory.findAsset(trx, id);
      if (!before) throw assetNotFound();

      if (patch.status !== undefined && patch.status !== before.status) {
        const from = before.status as AssetStatus;
        if (patch.status === 'in_transfer' || !canTransition(from, patch.status)) {
          throw invalidTransition(from, patch.status);
        }
        if (
          needsNoFutureBookings(from, patch.status) &&
          (await this.inventory.futureOccupancies(trx, id, this.clock.now())) > 0
        ) {
          throw hasFutureBookings('This asset still has upcoming bookings or blocks');
        }
      }

      await this.inventory.updateAsset(trx, id, {
        ...(patch.serialNo !== undefined && { serialNo: patch.serialNo }),
        ...(patch.status !== undefined && { status: patch.status }),
      });
      const after = await this.inventory.findAsset(trx, id);
      if (!after) throw assetNotFound();
      await this.audit.record(trx, {
        actor,
        action:
          patch.status && patch.status !== before.status ? 'asset.status_changed' : 'asset.updated',
        entityType: 'asset',
        entityId: id,
        before: snapshot(before),
        after: snapshot(after),
      });
      return after;
    });
  }
}

function encodeCursor(code: string): string {
  return Buffer.from(code, 'utf8').toString('base64url');
}
function decodeCursor(cursor: string): string {
  const code = Buffer.from(cursor, 'base64url').toString('utf8');
  if (!code || code.length > 80) throw invalidField('cursor', 'invalid cursor');
  return code;
}

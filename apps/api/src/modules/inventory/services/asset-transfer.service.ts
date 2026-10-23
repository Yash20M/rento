import { Inject, Injectable } from '@nestjs/common';
import { type Kysely, sql } from 'kysely';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import { AppError } from '../../../common/errors/app-error';
import { pgErrorCode } from '../../../db/errors';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { type Tx, withTransaction } from '../../../db/transaction';
import { type DrawerAccess, accessIncludes } from '../../access-control';
import { type Actor, AuditLog } from '../../reporting-audit';
import { assetNotFound, hasFutureBookings, invalidField } from '../domain/inventory-errors';
import type { TransferDto } from '../http/inventory.dto';

const YEAR_MS = 365 * 86_400_000;

interface TransferRow {
  id: string;
  asset_id: string;
  from_drawer_id: string;
  to_drawer_id: string;
  status: string;
  reason: string;
  started_at: Date;
  finished_at: Date | null;
}

const view = (t: TransferRow, assetCode: string): TransferDto => ({
  id: t.id,
  assetId: t.asset_id,
  assetCode,
  fromDrawerId: t.from_drawer_id,
  toDrawerId: t.to_drawer_id,
  status: t.status,
  reason: t.reason,
  startedAt: t.started_at.toISOString(),
  finishedAt: t.finished_at?.toISOString() ?? null,
});

const notInTransfer = (): AppError =>
  new AppError({
    status: 409,
    code: 'INVALID_STATE',
    detail: 'This asset is not being transferred',
  });

/**
 * Moving an asset to another drawer (README §9.9): start → the asset leaves service (`in_transfer`, a `transfer`
 * occupancy keeps every booking away) → complete at the other drawer, or cancel and it stays where it was. An asset
 * with upcoming bookings or blocks cannot start a transfer: the staff resolve those first, nothing is cancelled for them.
 */
@Injectable()
export class AssetTransferService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly audit: AuditLog,
  ) {}

  async current(access: DrawerAccess, assetId: string): Promise<TransferDto | null> {
    const asset = await this.asset(this.db, assetId);
    if (
      !asset ||
      !(accessIncludes(access, asset.drawer_id) || (await this.involves(access, assetId)))
    ) {
      throw assetNotFound();
    }
    const row = await sql<TransferRow>`
      SELECT * FROM asset_transfers WHERE asset_id = ${assetId} AND status = 'in_transit'`.execute(
      this.db,
    );
    return row.rows[0] ? view(row.rows[0], asset.asset_code) : null;
  }

  async start(
    actor: Actor,
    access: DrawerAccess,
    assetId: string,
    input: { toDrawerId: string; reason: string },
  ): Promise<TransferDto> {
    return withTransaction(this.db, async (trx) => {
      const asset = await this.asset(trx, assetId, true);
      if (!asset || !accessIncludes(access, asset.drawer_id)) throw assetNotFound();
      if (input.toDrawerId === asset.drawer_id) {
        throw invalidField('toDrawerId', 'is the drawer the asset is already in');
      }
      if (!accessIncludes(access, input.toDrawerId)) {
        throw new AppError({
          status: 403,
          code: 'PERMISSION_DENIED',
          detail: 'You do not have permission for the destination drawer',
        });
      }
      const target = await trx
        .selectFrom('drawers')
        .select(['id', 'status'])
        .where('id', '=', input.toDrawerId)
        .executeTakeFirst();
      if (!target) throw invalidField('toDrawerId', 'no such drawer');
      if (asset.status !== 'available') {
        throw new AppError({
          status: 409,
          code: 'IN_USE',
          detail: `Only an available asset can be transferred (this one is ${asset.status.replace('_', ' ')})`,
        });
      }
      const now = this.clock.now();
      const ahead = await sql<{ n: string }>`
        SELECT count(*) AS n FROM asset_occupancies
         WHERE asset_id = ${assetId} AND released_at IS NULL AND upper(during) > ${now}`.execute(
        trx,
      );
      if (Number(ahead.rows[0]?.n) > 0) {
        throw hasFutureBookings(
          'This asset still has upcoming bookings or blocks. Resolve them first',
        );
      }

      await sql`SAVEPOINT transfer`.execute(trx);
      let row: TransferRow;
      try {
        await sql`
          INSERT INTO asset_occupancies (asset_id, kind, during, reason, created_by)
          VALUES (${assetId}, 'transfer', tstzrange(${now}, ${new Date(now.getTime() + YEAR_MS)}, '[)'),
                  ${`Transfer: ${input.reason}`}, ${actor.id})`.execute(trx);
        await sql`RELEASE SAVEPOINT transfer`.execute(trx);
        const inserted = await sql<TransferRow>`
          INSERT INTO asset_transfers (asset_id, from_drawer_id, to_drawer_id, reason, started_by, started_at)
          VALUES (${assetId}, ${asset.drawer_id}, ${input.toDrawerId}, ${input.reason}, ${actor.id}, ${now})
          RETURNING *`.execute(trx);
        row = inserted.rows[0]!;
      } catch (error) {
        if (pgErrorCode(error) !== '23P01') throw error;
        await sql`ROLLBACK TO SAVEPOINT transfer`.execute(trx);
        throw hasFutureBookings('A booking was made for this asset a moment ago. Resolve it first');
      }
      await sql`UPDATE assets SET status = 'in_transfer', updated_at = now() WHERE id = ${assetId}`.execute(
        trx,
      );
      await this.audit.record(trx, {
        actor,
        action: 'asset.transfer_started',
        entityType: 'asset',
        entityId: assetId,
        before: { drawerId: asset.drawer_id, status: 'available' },
        after: { toDrawerId: input.toDrawerId, status: 'in_transfer' },
        reason: input.reason,
      });
      return view(row, asset.asset_code);
    });
  }

  /** The asset arrived: it now belongs to the destination drawer and can be booked there. */
  async complete(actor: Actor, access: DrawerAccess, assetId: string): Promise<TransferDto> {
    return this.finish(actor, access, assetId, 'completed');
  }

  /** The asset stays where it was. */
  async cancel(actor: Actor, access: DrawerAccess, assetId: string): Promise<TransferDto> {
    return this.finish(actor, access, assetId, 'cancelled');
  }

  private async finish(
    actor: Actor,
    access: DrawerAccess,
    assetId: string,
    outcome: 'completed' | 'cancelled',
  ): Promise<TransferDto> {
    return withTransaction(this.db, async (trx) => {
      const asset = await this.asset(trx, assetId, true);
      if (!asset) throw assetNotFound();
      const open = await sql<TransferRow>`
        SELECT * FROM asset_transfers WHERE asset_id = ${assetId} AND status = 'in_transit' FOR UPDATE`.execute(
        trx,
      );
      const transfer = open.rows[0];
      // Either end of the journey may finish it; anyone else sees nothing.
      if (
        !transfer ||
        !(
          accessIncludes(access, transfer.from_drawer_id) ||
          accessIncludes(access, transfer.to_drawer_id)
        )
      ) {
        throw transfer ? assetNotFound() : notInTransfer();
      }
      if (outcome === 'completed' && !accessIncludes(access, transfer.to_drawer_id)) {
        throw new AppError({
          status: 403,
          code: 'PERMISSION_DENIED',
          detail: 'Only someone with access to the destination drawer can receive the asset',
        });
      }
      const now = this.clock.now();
      await sql`
        UPDATE asset_occupancies SET released_at = ${now}
         WHERE asset_id = ${assetId} AND kind = 'transfer' AND released_at IS NULL`.execute(trx);
      await sql`
        UPDATE assets SET status = 'available', updated_at = now(),
               drawer_id = ${outcome === 'completed' ? transfer.to_drawer_id : transfer.from_drawer_id}
         WHERE id = ${assetId}`.execute(trx);
      const done = await sql<TransferRow>`
        UPDATE asset_transfers SET status = ${outcome}, finished_at = ${now}, finished_by = ${actor.id}
         WHERE id = ${transfer.id} RETURNING *`.execute(trx);
      await this.audit.record(trx, {
        actor,
        action: outcome === 'completed' ? 'asset.transfer_completed' : 'asset.transfer_cancelled',
        entityType: 'asset',
        entityId: assetId,
        before: { drawerId: transfer.from_drawer_id, status: 'in_transfer' },
        after: {
          drawerId: outcome === 'completed' ? transfer.to_drawer_id : transfer.from_drawer_id,
          status: 'available',
        },
      });
      return view(done.rows[0]!, asset.asset_code);
    });
  }

  private async involves(access: DrawerAccess, assetId: string): Promise<boolean> {
    const open = await sql<TransferRow>`
      SELECT * FROM asset_transfers WHERE asset_id = ${assetId} AND status = 'in_transit'`.execute(
      this.db,
    );
    const t = open.rows[0];
    return (
      t !== undefined &&
      (accessIncludes(access, t.from_drawer_id) || accessIncludes(access, t.to_drawer_id))
    );
  }

  private async asset(db: Kysely<Database> | Tx, id: string, lock = false) {
    const query = db
      .selectFrom('assets')
      .select(['id', 'asset_code', 'drawer_id', 'status'])
      .where('id', '=', id);
    return (lock ? query.forUpdate() : query).executeTakeFirst();
  }
}

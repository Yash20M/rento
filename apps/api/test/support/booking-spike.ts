import { type Kysely, sql } from 'kysely';
import { pgErrorCode, SlotTakenError } from '../../src/db/errors';
import type { Database } from '../../src/db/kysely';
import { type Tx, withTransaction } from '../../src/db/transaction';

/**
 * TEST-ONLY PROTOTYPE of README §9.4 steps 5–7 (P1-06 spike). The production booking service is P2-22;
 * this exists to prove the algorithm and the schema under real parallel load.
 */
export interface ClaimInput {
  userId: string;
  drawerId: string;
  itemModelId: string;
  startsAt: Date;
  endsAt: Date;
  bufferMin: number;
  /**
   * What to do when matching assets exist but are all row-locked by in-flight claims:
   * - 'conflict' (README §9.4 as written): they are skipped → 409 even if the slot is actually free.
   * - 'wait': fall back to a blocking lock (bounded by lock_timeout) so the request is decided on the
   *   truth. Only taken while this transaction holds NO other asset lock, which rules out lock cycles.
   */
  lockedPolicy?: 'conflict' | 'wait';
  /** Test hook: runs inside the transaction after the occupancy insert, before commit. */
  beforeCommit?: () => Promise<void>;
}

export interface Claim {
  assetId: string;
  bookingId: string;
}

const MAX_ATTEMPTS = 3;

export async function claimSlot(db: Kysely<Database>, input: ClaimInput): Promise<Claim> {
  const from = input.startsAt.toISOString();
  const to = new Date(input.endsAt.getTime() + input.bufferMin * 60_000).toISOString();

  return withTransaction(db, async (trx: Tx) => {
    const tried: string[] = [];

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      // Candidate selection is an optimisation to reduce contention — NOT the guarantee.
      const findCandidate = (lock: ReturnType<typeof sql>) =>
        sql<{ id: string }>`
        SELECT a.id
          FROM assets a
         WHERE a.drawer_id = ${input.drawerId}
           AND a.item_model_id = ${input.itemModelId}
           AND a.status = 'available'
           AND NOT (a.id = ANY (${tried}::uuid[]))
           AND NOT EXISTS (
                 SELECT 1 FROM asset_occupancies o
                  WHERE o.asset_id = a.id AND o.released_at IS NULL
                    AND o.during && tstzrange(${from}::timestamptz, ${to}::timestamptz, '[)'))
         ORDER BY a.asset_code
           ${lock}
         LIMIT 1`.execute(trx);

      let candidate = await findCandidate(sql`FOR UPDATE OF a SKIP LOCKED`);
      if (candidate.rows.length === 0 && input.lockedPolicy === 'wait' && tried.length === 0) {
        candidate = await findCandidate(sql`FOR UPDATE OF a`);
      }

      const assetId = candidate.rows[0]?.id;
      if (assetId === undefined) break;
      tried.push(assetId);

      await sql`SAVEPOINT claim`.execute(trx);
      try {
        const booking = await trx
          .insertInto('bookings')
          .values({
            user_id: input.userId,
            asset_id: assetId,
            drawer_id: input.drawerId,
            item_model_id: input.itemModelId,
            status: 'held',
            starts_at: from,
            ends_at: input.endsAt.toISOString(),
            buffer_min: input.bufferMin,
            hold_expires_at: new Date(input.startsAt.getTime() - 60_000).toISOString(),
            price_paise: 4900,
          })
          .returning('id')
          .executeTakeFirstOrThrow();

        await trx
          .insertInto('asset_occupancies')
          .values({
            asset_id: assetId,
            kind: 'booking',
            booking_id: booking.id,
            during: sql`tstzrange(${from}::timestamptz, ${to}::timestamptz, '[)')`,
          })
          .execute();

        await sql`RELEASE SAVEPOINT claim`.execute(trx);
        await input.beforeCommit?.();
        return { assetId, bookingId: booking.id };
      } catch (error) {
        if (pgErrorCode(error) !== '23P01') throw error;
        // Lost the race for this asset: undo the booking row too, then try the next candidate.
        await sql`ROLLBACK TO SAVEPOINT claim`.execute(trx);
      }
    }

    throw new SlotTakenError();
  });
}

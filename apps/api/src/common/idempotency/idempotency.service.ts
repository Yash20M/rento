import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { type Tx, withTransaction } from '../../db/transaction';
import type { Database } from '../../db/kysely';
import { KYSELY } from '../../db/tokens';
import { CLOCK, type Clock } from '../clock/clock';
import { AppError } from '../errors/app-error';

/** A claim that never completed (the process died) is taken over after this long. */
const STALE_CLAIM_MS = 2 * 60_000;
/** Completed keys are kept this long so a client retrying a timed-out request still gets its answer (README §9.6). */
const RETENTION_MS = 24 * 3_600_000;

export interface StoredResponse {
  status: number;
  body: unknown;
}

export interface IdempotentResult extends StoredResponse {
  /** True when the answer was stored by an earlier request with the same key. */
  replayed: boolean;
}

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
};

/** Same method, path and body ⇒ same hash, whatever the key order of the JSON. */
export const requestHash = (method: string, path: string, body: unknown): string =>
  createHash('sha256')
    .update(`${method} ${path}\n${canonical(body)}`)
    .digest('hex');

export const requestInProgress = (): AppError =>
  new AppError({
    status: 409,
    code: 'REQUEST_IN_PROGRESS',
    detail: 'A request with this Idempotency-Key is still being processed; retry in a moment',
  });
export const idempotencyKeyReused = (): AppError =>
  new AppError({
    status: 422,
    code: 'IDEMPOTENCY_KEY_REUSED',
    detail: 'This Idempotency-Key was already used for a different request',
  });

/**
 * `Idempotency-Key` support (README §9.6, P2-15). Keys are scoped per user.
 *
 * 1. The key is CLAIMED in its own short transaction, so concurrent requests with the same key see it at once
 *    (`409 REQUEST_IN_PROGRESS`) instead of queueing on a lock.
 * 2. The work and the stored response are committed in ONE transaction: a crash can never leave a result without its
 *    replay record, nor a replay record without its result.
 * 3. If the work fails, the claim is removed so the client may retry with the same key.
 */
@Injectable()
export class IdempotencyService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async run(
    userId: string,
    key: string,
    hash: string,
    work: (trx: Tx) => Promise<StoredResponse>,
  ): Promise<IdempotentResult> {
    const replay = await this.claim(userId, key, hash);
    if (replay) return { ...replay, replayed: true };

    try {
      return await withTransaction(this.db, async (trx) => {
        const result = await work(trx);
        await trx
          .updateTable('idempotency_keys')
          .set({
            response_status: result.status,
            response_body: JSON.stringify(result.body),
            completed_at: this.clock.now(),
          })
          .where('user_id', '=', userId)
          .where('key', '=', key)
          .execute();
        return { ...result, replayed: false };
      });
    } catch (error) {
      await this.db
        .deleteFrom('idempotency_keys')
        .where('user_id', '=', userId)
        .where('key', '=', key)
        .where('response_status', 'is', null)
        .execute();
      throw error;
    }
  }

  /** Completed keys past retention are removed (called by the background sweep). */
  async purgeExpired(): Promise<number> {
    const cutoff = new Date(this.clock.now().getTime() - RETENTION_MS);
    const result = await this.db
      .deleteFrom('idempotency_keys')
      .where('completed_at', '<', cutoff)
      .executeTakeFirst();
    return Number(result.numDeletedRows);
  }

  /** Returns the stored answer to replay, or `undefined` once this request owns the key. */
  private async claim(
    userId: string,
    key: string,
    hash: string,
  ): Promise<StoredResponse | undefined> {
    const now = this.clock.now();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const inserted = await this.db
        .insertInto('idempotency_keys')
        .values({ user_id: userId, key, request_hash: hash, created_at: now })
        .onConflict((oc) => oc.columns(['user_id', 'key']).doNothing())
        .returning('key')
        .executeTakeFirst();
      if (inserted) return undefined;

      const existing = await this.db
        .selectFrom('idempotency_keys')
        .selectAll()
        .where('user_id', '=', userId)
        .where('key', '=', key)
        .executeTakeFirst();
      if (!existing) continue; // the earlier attempt failed and removed its claim in between: try again

      if (existing.request_hash !== hash) throw idempotencyKeyReused();
      if (existing.response_status !== null) {
        return { status: existing.response_status, body: existing.response_body };
      }
      const stale = new Date(now.getTime() - STALE_CLAIM_MS);
      const taken = await this.db
        .updateTable('idempotency_keys')
        .set({ created_at: now })
        .where('user_id', '=', userId)
        .where('key', '=', key)
        .where('response_status', 'is', null)
        .where('created_at', '<', stale)
        .returning('key')
        .executeTakeFirst();
      if (taken) return undefined;
      throw requestInProgress();
    }
    throw requestInProgress();
  }
}

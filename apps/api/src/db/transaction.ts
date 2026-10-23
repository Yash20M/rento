import { Inject, Injectable } from '@nestjs/common';
import { type Kysely, type Transaction, sql } from 'kysely';
import { mapDbError } from './errors';
import type { Database } from './kysely';
import { KYSELY } from './tokens';

export type Tx = Transaction<Database>;

/** README §9.4: short transactions, bounded waits. */
export const DEFAULT_LOCK_TIMEOUT_MS = 3000;

export interface TransactionOptions {
  lockTimeoutMs?: number;
}

/**
 * The only way services open a transaction (README §12.3). READ COMMITTED; `lock_timeout` is applied with
 * `set_config(..., true)` (transaction-local, PgBouncer-safe); database failures leave as domain errors.
 */
export async function withTransaction<T>(
  db: Kysely<Database>,
  fn: (trx: Tx) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  const lockTimeoutMs = options.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
  try {
    return await db.transaction().execute(async (trx) => {
      await sql`select set_config('lock_timeout', ${`${lockTimeoutMs}ms`}, true)`.execute(trx);
      return fn(trx);
    });
  } catch (error) {
    throw mapDbError(error);
  }
}

@Injectable()
export class TransactionManager {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  run<T>(fn: (trx: Tx) => Promise<T>, options?: TransactionOptions): Promise<T> {
    return withTransaction(this.db, fn, options);
  }
}

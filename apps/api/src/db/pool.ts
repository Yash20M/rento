import { Pool } from 'pg';
import type { AppConfig } from '../config/app-config';

export const STATEMENT_TIMEOUT_MS = 15_000;
export const IDLE_IN_TRANSACTION_TIMEOUT_MS = 15_000;
export const CONNECTION_TIMEOUT_MS = 5_000;

/**
 * App-side pool (README §15). Only per-connection timeouts are set here — everything else the app needs
 * is transaction-scoped (`SET LOCAL`), so PgBouncer transaction pooling stays compatible.
 */
export function createPool(config: Pick<AppConfig, 'databaseUrl' | 'dbPoolMax'>): Pool {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: config.dbPoolMax,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    statement_timeout: STATEMENT_TIMEOUT_MS,
    idle_in_transaction_session_timeout: IDLE_IN_TRANSACTION_TIMEOUT_MS,
  });
  // An error on an idle client must not crash the process; the next query reports the failure.
  pool.on('error', () => undefined);
  return pool;
}

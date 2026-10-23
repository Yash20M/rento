import { type Kysely, sql } from 'kysely';
import type { Database } from '../../db/kysely';
import type { DatabasePing } from './database-ping';

const PING_TIMEOUT_MS = 2000;

/** Readiness probe on the shared pool: `select 1`, giving up after 2 s. */
export class KyselyDatabasePing implements DatabasePing {
  constructor(private readonly db: Kysely<Database>) {}

  async ping(): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('database ping timed out')), PING_TIMEOUT_MS);
    });
    try {
      await Promise.race([sql`select 1`.execute(this.db), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}

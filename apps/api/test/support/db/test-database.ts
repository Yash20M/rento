import { randomBytes } from 'node:crypto';
import type { Kysely } from 'kysely';
import { Client, Pool } from 'pg';
import { inject } from 'vitest';
import { type Database, createDb } from '../../../src/db/kysely';

export interface TestDatabase {
  /** Typed Kysely instance on the private database. */
  db: Kysely<Database>;
  /** The pool behind `db`, for raw SQL and multi-connection scenarios. */
  pool: Pool;
  url: string;
  name: string;
  /** Destroys the pool and drops the database. Call from `afterAll`. */
  drop(): Promise<void>;
}

async function withAdmin<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: inject('dbAdminUrl') });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/**
 * A database private to the caller: a clone of the migrated template (or an empty database with
 * `{ migrated: false }`). Never shared between test files.
 */
export async function createTestDatabase(
  options: { migrated?: boolean } = {},
): Promise<TestDatabase> {
  const name = `rento_test_${randomBytes(6).toString('hex')}`;
  const template = options.migrated === false ? 'template0' : inject('dbTemplateName');
  await withAdmin((client) => client.query(`CREATE DATABASE ${name} TEMPLATE ${template}`));

  const url = new URL(inject('dbAdminUrl'));
  url.pathname = `/${name}`;

  const pool = new Pool({ connectionString: url.toString(), max: 10 });
  // DROP DATABASE ... FORCE may terminate a connection that is still closing; that is not a test failure.
  pool.on('error', () => undefined);
  const db = createDb(pool);
  return {
    db,
    pool,
    url: url.toString(),
    name,
    drop: async () => {
      await db.destroy(); // ends the pool
      await withAdmin((client) => client.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`));
    },
  };
}

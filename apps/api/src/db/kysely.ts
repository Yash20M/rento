import { Kysely, PostgresDialect } from 'kysely';
import type { Pool } from 'pg';
import type { DB } from './generated/database';

export type Database = DB;

export function createDb(pool: Pool): Kysely<Database> {
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
}

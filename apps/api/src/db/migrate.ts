import path from 'node:path';
import { runner } from 'node-pg-migrate';

/** `apps/api/db/migrations` — resolves identically from `src/db` and `dist/db`. */
export const MIGRATIONS_DIR = path.resolve(__dirname, '../../db/migrations');
export const MIGRATIONS_TABLE = 'pgmigrations';

export interface MigrationLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

const silent: MigrationLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

/**
 * Applies all pending migrations, in order, in a single transaction under an advisory lock.
 * Forward-only by design: there is deliberately no `down` entry point (README §4.3, §15).
 * Returns the names of the migrations applied by this call (empty array = nothing to do).
 */
export async function runMigrations(
  databaseUrl: string,
  logger: MigrationLogger = silent,
): Promise<string[]> {
  const applied = await runner({
    databaseUrl,
    dir: MIGRATIONS_DIR,
    direction: 'up',
    migrationsTable: MIGRATIONS_TABLE,
    checkOrder: true,
    singleTransaction: true,
    log: (message: string) => logger.info(message),
    logger: {
      debug: () => undefined,
      info: (message: string) => logger.info(message),
      warn: (message: string) => logger.warn(message),
      error: (message: string) => logger.error(message),
    },
  });
  return applied.map((migration) => migration.name);
}

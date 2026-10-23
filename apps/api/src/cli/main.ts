import { Pool } from 'pg';
import { SystemClock } from '../common/clock/clock';
import { ConfigError, loadConfig } from '../config/app-config';
import { createDb } from '../db/kysely';
import { bootstrapSuperAdmin } from '../modules/access-control/services/super-admin-bootstrap';
import { parseCommand, usage } from './args';
import { formatOutcome } from './format';

/**
 * Server-side operator CLI: `pnpm --filter api cli <command> …`. It talks straight to the database and never starts
 * the HTTP server. Exit codes: 0 done / nothing to do, 1 refused or failed, 2 usage error.
 */
async function main(): Promise<number> {
  const parsed = parseCommand(process.argv.slice(2));
  if (parsed.kind === 'usage') {
    process.stderr.write(`${parsed.message}\n\n${usage()}\n`);
    return 2;
  }

  let config;
  try {
    config = loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      process.stderr.write(`${error.message}\n`);
      return 1;
    }
    throw error;
  }

  const pool = new Pool({ connectionString: config.databaseUrl, max: 2 });
  try {
    const outcome = await bootstrapSuperAdmin(
      { db: createDb(pool), config, clock: new SystemClock() },
      parsed.input,
    );
    const { text, exitCode } = formatOutcome(outcome);
    process.stdout.write(`${text}\n`);
    return exitCode;
  } catch (error) {
    // Driver errors can embed connection details; print only the sanitized reason.
    const reason = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `bootstrap-super-admin failed: ${reason.replaceAll(config.databaseUrl, '[DATABASE_URL]')}\n`,
    );
    return 1;
  } finally {
    await pool.end();
  }
}

void main().then((code) => {
  process.exitCode = code;
});

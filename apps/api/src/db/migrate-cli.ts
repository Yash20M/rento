import { ConfigError, loadConfig } from '../config/app-config';
import { runMigrations } from './migrate';

/** `pnpm --filter api migrate` — applies pending migrations to DATABASE_URL. Never prints the URL. */
async function main(): Promise<void> {
  let databaseUrl: string;
  try {
    databaseUrl = loadConfig(process.env).databaseUrl;
  } catch (error) {
    if (error instanceof ConfigError) {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }

  try {
    const applied = await runMigrations(databaseUrl);
    process.stdout.write(
      applied.length === 0
        ? 'Nothing to migrate.\n'
        : `Applied ${applied.length} migration(s):\n${applied.map((name) => `  - ${name}`).join('\n')}\n`,
    );
  } catch (error) {
    // Driver errors can embed host/user details; print only the sanitized reason.
    const reason = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Migration failed: ${reason.replaceAll(databaseUrl, '[DATABASE_URL]')}\n`);
    process.exit(1);
  }
}

void main();

import { expect } from 'vitest';
import { createFactories } from '../../factories';
import { createTestDatabase } from './test-database';

/**
 * Shared body of the two isolation specs. Each spec file runs in its own worker, in parallel; if the
 * fixture ever shared a database, one of them would see the other's marker user.
 */
export async function runIsolationScenario(marker: string): Promise<void> {
  const database = await createTestDatabase();
  try {
    const f = createFactories(database.db);
    await f.user({ email: `${marker}@example.com` });
    for (let i = 0; i < 25; i += 1) await f.category();

    const users = await database.pool.query<{ email: string }>('SELECT email FROM users');
    expect(users.rows).toEqual([{ email: `${marker}@example.com` }]);
  } finally {
    await database.drop();
  }
}

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';

// The startup check against a real, migrated database (README §13.5: "a startup/CI check fails if the code and the
// permissions table drift").

let database: TestDatabase;
beforeAll(async () => {
  database = await createTestDatabase();
});
afterAll(async () => {
  await database.drop();
});

const boot = () => createTestApp({ config: testConfig({ DATABASE_URL: database.url }) });

describe('permission catalog at startup', () => {
  it('C-1 boots on a freshly migrated database', async () => {
    const app = await boot();
    await app.app.close();
  });

  it('C-2 an extra key in the database boots, with a warning that names it', async () => {
    await database.pool.query(
      `INSERT INTO permissions (key, group_name, description) VALUES ('future:thing', 'Future', 'From a newer build')`,
    );
    const app = await boot();
    try {
      const warned = app.logLines.join('\n');
      expect(warned).toContain('future:thing');
    } finally {
      await app.app.close();
      await database.pool.query(`DELETE FROM permissions WHERE key = 'future:thing'`);
    }
  });

  it('C-3 a code permission missing from the database refuses to start and names it', async () => {
    await database.pool.query(`DELETE FROM permissions WHERE key = 'bookings:refund'`);
    try {
      await expect(boot()).rejects.toThrow(/bookings:refund/);
    } finally {
      await database.pool.query(
        `INSERT INTO permissions (key, group_name, description) VALUES ('bookings:refund', 'Bookings', 'Override refund amounts')`,
      );
    }
  });
});

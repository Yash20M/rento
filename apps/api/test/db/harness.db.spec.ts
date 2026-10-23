import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it, inject } from 'vitest';
import { createPool } from '../../src/db/pool';
import { IDLE_IN_TRANSACTION_TIMEOUT_MS, STATEMENT_TIMEOUT_MS } from '../../src/db/pool';
import { createFactories } from '../factories';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';

const run = promisify(execFile);
const apiRoot = path.resolve(__dirname, '../..');
const codegenBin = path.join(apiRoot, 'node_modules/kysely-codegen/dist/cli/bin.js');

let db: TestDatabase;
beforeAll(async () => {
  db = await createTestDatabase();
});
afterAll(async () => {
  await db.drop();
});

describe('pool', () => {
  it('D-12 applies max, statement_timeout and idle_in_transaction_session_timeout', async () => {
    const pool = createPool({ databaseUrl: db.url, dbPoolMax: 7 });
    try {
      expect(pool.options.max).toBe(7);
      const res = await pool.query<{ statement_timeout: string; idle: string }>(
        `select current_setting('statement_timeout') as statement_timeout,
                current_setting('idle_in_transaction_session_timeout') as idle`,
      );
      expect(STATEMENT_TIMEOUT_MS).toBe(15_000);
      expect(IDLE_IN_TRANSACTION_TIMEOUT_MS).toBe(15_000);
      expect(res.rows[0]).toEqual({ statement_timeout: '15s', idle: '15s' });
    } finally {
      await pool.end();
    }
  });
});

describe('generated types', () => {
  const verify = (url: string) =>
    run(process.execPath, [codegenBin, '--verify', '--url', url], { cwd: apiRoot });

  it('D-13 src/db/generated/database.ts matches the migrated schema', async () => {
    await expect(verify(db.url)).resolves.toBeDefined();
  });

  it('D-13b the drift check really fails when the schema differs', async () => {
    const empty = await createTestDatabase({ migrated: false });
    try {
      await expect(verify(empty.url)).rejects.toBeDefined();
    } finally {
      await empty.drop();
    }
  });
});

describe('fixture isolation', () => {
  it('D-14 two databases in one file are private and independent', async () => {
    const other = await createTestDatabase();
    try {
      expect(other.name).not.toBe(db.name);
      await createFactories(db.db).user({ email: 'only-in-first@example.com' });

      const inOther = await other.pool.query('SELECT 1 FROM users');
      expect(inOther.rowCount).toBe(0);
      const inFirst = await db.pool.query('SELECT 1 FROM users');
      expect(inFirst.rowCount).toBe(1);
    } finally {
      await other.drop();
    }
  });

  it('D-15 the template database stays pristine (empty tables)', async () => {
    const adminUrl = new URL(inject('dbAdminUrl'));
    adminUrl.pathname = `/${inject('dbTemplateName')}`;
    const client = new Client({ connectionString: adminUrl.toString() });
    await client.connect();
    try {
      for (const table of ['users', 'drawers', 'assets', 'bookings', 'asset_occupancies']) {
        const res = await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`);
        expect(res.rows[0]?.n, table).toBe(0);
      }
    } finally {
      await client.end();
    }
  });
});

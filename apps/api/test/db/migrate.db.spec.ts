import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runMigrations } from '../../src/db/migrate';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';

const EXPECTED_TABLES = [
  'assets',
  'asset_occupancies',
  'bookings',
  'categories',
  'drawers',
  'item_models',
  'refresh_tokens',
  'user_identities',
  'users',
];

let db: TestDatabase;
beforeAll(async () => {
  db = await createTestDatabase({ migrated: false });
  await runMigrations(db.url);
});
afterAll(async () => {
  await db.drop();
});

describe('migrations', () => {
  it('D-01 a fresh database gets every baseline table, extension and a pgmigrations row', async () => {
    const tables = await db.pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const names = tables.rows.map((row) => row.table_name);
    for (const table of [...EXPECTED_TABLES, 'pgmigrations']) expect(names).toContain(table);

    const extensions = await db.pool.query<{ extname: string }>('SELECT extname FROM pg_extension');
    const installed = extensions.rows.map((row) => row.extname);
    for (const ext of ['postgis', 'btree_gist', 'pgcrypto', 'citext']) {
      expect(installed).toContain(ext);
    }

    const applied = await db.pool.query<{ name: string }>(
      'SELECT name FROM pgmigrations ORDER BY id',
    );
    expect(applied.rows.map((row) => row.name)).toEqual([
      '0001_baseline',
      '0002_auth',
      '0003_auth_tokens',
      '0004_permissions',
      '0005_roles',
      '0006_admin_invitations',
      '0007_audit_logs',
      '0008_drawer_hours_closures',
      '0009_booking_engine',
      '0010_booking_extensions',
      '0011_kyc',
      '0012_webhook_events',
      '0013_occupancy_blocks',
      '0014_transfers_reminders',
      '0015_media',
      '0016_app_settings',
      '0017_profile_and_drawer_photos',
      '0018_mfa',
    ]);
  });

  it('D-02 running migrate again is a no-op', async () => {
    const before = await db.pool.query('SELECT count(*)::int AS n FROM pgmigrations');
    const applied = await runMigrations(db.url);
    const after = await db.pool.query('SELECT count(*)::int AS n FROM pgmigrations');

    expect(applied).toEqual([]);
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it('D-16 no column in the schema is timestamp-without-time-zone (UTC rule)', async () => {
    const naive = await db.pool.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND data_type = 'timestamp without time zone'
         AND table_name <> 'pgmigrations'`,
    );
    expect(naive.rows).toEqual([]);
  });
});

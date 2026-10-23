import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type BootstrapOutcome,
  bootstrapSuperAdmin,
} from '../../src/modules/access-control/services/super-admin-bootstrap';
import { testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeClock } from '../support/fake-clock';

const START = '2030-01-01T00:00:00Z';

let database: TestDatabase;
const clock = new FakeClock(START);
let counter = 0;

beforeAll(async () => {
  database = await createTestDatabase();
});
afterAll(async () => {
  await database.drop();
});

const email = (tag = 'admin') => `${tag}-${(counter += 1)}-${Date.now()}@example.com`;
const config = () =>
  testConfig({ DATABASE_URL: database.url, PUBLIC_WEB_URL: 'https://app.rento.example' });
const run = (input: {
  email: string;
  name?: string;
  forceAdditional?: boolean;
}): Promise<BootstrapOutcome> =>
  bootstrapSuperAdmin({ db: database.db, config: config(), clock }, input);
const superAdminCount = async () =>
  Number(
    (
      await database.pool.query(
        `SELECT count(*)::int AS n FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.is_super_admin`,
      )
    ).rows[0].n,
  );
const resetLinkToken = (outcome: BootstrapOutcome): string => {
  if (outcome.kind === 'refused' || !outcome.setup) throw new Error('no setup link');
  return new URL(outcome.setup.link).searchParams.get('token')!;
};

// The suite shares one database and the rule is "the first Super Admin", so tests that need an empty slate reset it.
const resetSuperAdmins = () =>
  database.pool.query(
    `DELETE FROM user_roles WHERE role_id IN (SELECT id FROM roles WHERE is_super_admin)`,
  );

describe('bootstrap-super-admin', () => {
  it('B-1 creates a password-less account, assigns the locked role and returns a one-time setup link', async () => {
    await resetSuperAdmins();
    const address = email();
    const outcome = await run({ email: address.toUpperCase(), name: 'Asha Admin' });

    expect(outcome).toMatchObject({ kind: 'created', email: address });
    const user = (await database.pool.query('SELECT * FROM users WHERE email = $1', [address]))
      .rows[0];
    expect(user).toMatchObject({
      status: 'active',
      display_name: 'Asha Admin',
      email_verified_at: null,
    });

    const assignment = await database.pool.query(
      `SELECT r.name, ur.drawer_id, ur.granted_by FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1`,
      [user.id],
    );
    expect(assignment.rows).toEqual([{ name: 'Super Admin', drawer_id: null, granted_by: null }]);

    // no password identity exists: nothing to log in with until the link is used
    const identities = await database.pool.query(
      'SELECT 1 FROM user_identities WHERE user_id = $1',
      [user.id],
    );
    expect(identities.rowCount).toBe(0);

    if (outcome.kind === 'refused') throw new Error('unreachable');
    expect(outcome.setup?.link).toMatch(
      /^https:\/\/app\.rento\.example\/reset-password\?token=[A-Za-z0-9_-]{20,}$/,
    );
    expect(outcome.setup?.expiresInMinutes).toBe(60);
  });

  it('B-2 only the HASH of the setup token is stored, as a single-use password_reset token bound to the email', async () => {
    await resetSuperAdmins();
    const address = email();
    const outcome = await run({ email: address });
    const token = resetLinkToken(outcome);

    const stored = await database.pool.query(
      'SELECT purpose, email, token_hash, used_at, expires_at FROM auth_tokens WHERE token_hash = $1',
      [createHash('sha256').update(token).digest('hex')],
    );
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0]).toMatchObject({
      purpose: 'password_reset',
      email: address,
      used_at: null,
    });
    expect(stored.rows[0].expires_at).toEqual(new Date(new Date(START).getTime() + 60 * 60_000));
    const raw = await database.pool.query('SELECT 1 FROM auth_tokens WHERE token_hash = $1', [
      token,
    ]);
    expect(raw.rowCount).toBe(0);
  });

  it('B-3 running it again for the same email is a no-op that only offers a fresh link while there is no password', async () => {
    await resetSuperAdmins();
    const address = email();
    const first = await run({ email: address });
    const second = await run({ email: address });

    expect(second).toMatchObject({ kind: 'already', email: address });
    expect(await superAdminCount()).toBe(1);
    expect(resetLinkToken(second)).not.toBe(resetLinkToken(first));
    // the older link is dead now (superseded)
    const old = await database.pool.query(
      `SELECT revoked_at FROM auth_tokens WHERE token_hash = $1`,
      [createHash('sha256').update(resetLinkToken(first)).digest('hex')],
    );
    expect(old.rows[0].revoked_at).not.toBeNull();
  });

  it('B-4 once a Super Admin exists, a different email is refused and nothing is created', async () => {
    await resetSuperAdmins();
    await run({ email: email('first') });
    const stranger = email('stranger');
    const outcome = await run({ email: stranger });

    expect(outcome).toEqual({ kind: 'refused', reason: 'super_admin_exists' });
    expect(
      (await database.pool.query('SELECT 1 FROM users WHERE email = $1', [stranger])).rowCount,
    ).toBe(0);
    expect(await superAdminCount()).toBe(1);
  });

  it('B-5 --force-additional adds a second Super Admin on purpose', async () => {
    await resetSuperAdmins();
    await run({ email: email('first') });
    const outcome = await run({ email: email('second'), forceAdditional: true });
    expect(outcome.kind).toBe('created');
    expect(await superAdminCount()).toBe(2);
  });

  it('B-6 an existing customer is promoted in place: same account, password untouched, no link', async () => {
    await resetSuperAdmins();
    const address = email('customer');
    const hash = '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHQ$aGFzaA';
    const id = (
      await database.pool.query<{ id: string }>(
        `INSERT INTO users (email, display_name, email_verified_at) VALUES ($1, 'Carl Customer', now()) RETURNING id`,
        [address],
      )
    ).rows[0]!.id;
    await database.pool.query(
      `INSERT INTO user_identities (user_id, provider, provider_subject, password_hash, provider_email) VALUES ($1::uuid, 'password', $1::text, $2, $3)`,
      [id, hash, address],
    );

    const outcome = await run({ email: address, name: 'Ignored Name' });

    expect(outcome).toMatchObject({ kind: 'promoted', userId: id });
    expect(outcome.kind !== 'refused' && outcome.setup).toBeFalsy();
    const after = (await database.pool.query('SELECT display_name FROM users WHERE id = $1', [id]))
      .rows[0];
    expect(after.display_name).toBe('Carl Customer'); // an existing profile is never overwritten
    const identity = await database.pool.query(
      `SELECT password_hash FROM user_identities WHERE user_id = $1 AND provider = 'password'`,
      [id],
    );
    expect(identity.rows[0].password_hash).toBe(hash);
    expect(await superAdminCount()).toBe(1);
  });

  it('B-7 a social-only customer without a password gets a setup link', async () => {
    await resetSuperAdmins();
    const address = email('social');
    const id = (
      await database.pool.query<{ id: string }>(
        `INSERT INTO users (email, email_verified_at) VALUES ($1, now()) RETURNING id`,
        [address],
      )
    ).rows[0]!.id;
    await database.pool.query(
      `INSERT INTO user_identities (user_id, provider, provider_subject) VALUES ($1, 'google', 'sub-1')`,
      [id],
    );
    const outcome = await run({ email: address });
    expect(outcome).toMatchObject({ kind: 'promoted', userId: id });
    expect(outcome.kind !== 'refused' && outcome.setup?.link).toBeTruthy();
  });

  it.each(['suspended', 'deleted'])('B-8 a %s account is refused, not promoted', async (status) => {
    await resetSuperAdmins();
    const address = email(status);
    await database.pool.query(`INSERT INTO users (email, status) VALUES ($1, $2)`, [
      address,
      status,
    ]);
    expect(await run({ email: address })).toEqual({
      kind: 'refused',
      reason: 'account_not_active',
    });
    expect(await superAdminCount()).toBe(0);
  });

  it('B-9 if the only Super Admin is suspended, a new one can be bootstrapped (recovery from lock-out)', async () => {
    await resetSuperAdmins();
    const first = email('locked-out');
    const outcome = await run({ email: first });
    if (outcome.kind === 'refused') throw new Error('unreachable');
    await database.pool.query(`UPDATE users SET status = 'suspended' WHERE id = $1`, [
      outcome.userId,
    ]);

    const recovery = await run({ email: email('recovery') });
    expect(recovery.kind).toBe('created');
  });

  it('B-10 simultaneous runs for different emails create exactly one Super Admin', async () => {
    await resetSuperAdmins();
    const outcomes = await Promise.all(
      Array.from({ length: 6 }, () => run({ email: email('race') })),
    );
    expect(outcomes.filter((o) => o.kind === 'created')).toHaveLength(1);
    expect(outcomes.filter((o) => o.kind === 'refused')).toHaveLength(5);
    expect(await superAdminCount()).toBe(1);
  });

  it('B-11 simultaneous runs for the same email are idempotent', async () => {
    await resetSuperAdmins();
    const address = email('same');
    const outcomes = await Promise.all(Array.from({ length: 5 }, () => run({ email: address })));
    expect(outcomes.filter((o) => o.kind === 'created')).toHaveLength(1);
    expect(outcomes.filter((o) => o.kind === 'already')).toHaveLength(4);
    expect(await superAdminCount()).toBe(1);
    expect(
      (await database.pool.query('SELECT 1 FROM users WHERE email = $1', [address])).rowCount,
    ).toBe(1);
  });

  it('B-12 a failure rolls everything back (no half-created admin)', async () => {
    await resetSuperAdmins();
    const address = email('atomic');
    await database.pool.query(
      `ALTER TABLE auth_tokens ADD CONSTRAINT fail_all CHECK (false) NOT VALID`,
    );
    try {
      await expect(run({ email: address })).rejects.toBeDefined();
    } finally {
      await database.pool.query(`ALTER TABLE auth_tokens DROP CONSTRAINT fail_all`);
    }
    expect(
      (await database.pool.query('SELECT 1 FROM users WHERE email = $1', [address])).rowCount,
    ).toBe(0);
    expect(await superAdminCount()).toBe(0);
  });
});

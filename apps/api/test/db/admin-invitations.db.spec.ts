import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Factories, createFactories } from '../factories';
import { expectPgError } from '../support/db/pg-assert';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';

const CHECK_VIOLATION = '23514';
const UNIQUE_VIOLATION = '23505';

let db: TestDatabase;
let f: Factories;
let inviterId: string;
let counter = 0;
beforeAll(async () => {
  db = await createTestDatabase();
  f = createFactories(db.db);
  inviterId = (await f.user()).id;
});
afterAll(async () => {
  await db.drop();
});

const hash = () => `hash-${(counter += 1)}-${Date.now()}`;
const invite = (email: string, extra: { accepted?: boolean; revoked?: boolean } = {}) =>
  db.pool.query(
    `INSERT INTO admin_invitations (email, token_hash, invited_by, expires_at, accepted_at, accepted_by, revoked_at)
     VALUES ($1, $2, $3, now() + interval '1 day', $4, $5, $6) RETURNING id`,
    [
      email,
      hash(),
      inviterId,
      extra.accepted ? new Date() : null,
      extra.accepted ? inviterId : null,
      extra.revoked ? new Date() : null,
    ],
  );
const email = () => `invitee-${(counter += 1)}-${Date.now()}@example.com`;

describe('admin_invitations', () => {
  it('I-1 only one OPEN invitation per address (case-insensitive); used or revoked ones do not count', async () => {
    const address = email();
    await invite(address);
    await expectPgError(invite(address.toUpperCase()), {
      code: UNIQUE_VIOLATION,
      constraint: 'admin_invitations_open_email_key',
    });
    await invite(email(), { accepted: true });

    const other = email();
    await invite(other, { revoked: true });
    await invite(other, { revoked: true });
    await invite(other); // a fresh open one is fine next to revoked ones
  });

  it('I-2 an invitation cannot be both accepted and revoked', async () => {
    await expectPgError(
      db.pool.query(
        `INSERT INTO admin_invitations (email, token_hash, invited_by, expires_at, accepted_at, revoked_at)
         VALUES ($1, $2, $3, now(), now(), now())`,
        [email(), hash(), inviterId],
      ),
      { code: CHECK_VIOLATION, constraint: 'admin_invitations_accepted_xor_revoked' },
    );
  });

  it('I-3 token hashes are unique', async () => {
    const token = hash();
    const insert = () =>
      db.pool.query(
        `INSERT INTO admin_invitations (email, token_hash, invited_by, expires_at) VALUES ($1, $2, $3, now())`,
        [email(), token, inviterId],
      );
    await insert();
    await expectPgError(insert(), {
      code: UNIQUE_VIOLATION,
      constraint: 'admin_invitations_token_hash_key',
    });
  });
});

describe('admin_invitation_roles', () => {
  const role = async () =>
    (
      await db.pool.query<{ id: string }>('INSERT INTO roles (name) VALUES ($1) RETURNING id', [
        `Invite role ${(counter += 1)}-${Date.now()}`,
      ])
    ).rows[0]!.id;

  it('I-4 the same role/scope twice on one invitation is rejected', async () => {
    const id = (await invite(email())).rows[0].id as string;
    const roleId = await role();
    await db.pool.query(
      'INSERT INTO admin_invitation_roles (invitation_id, role_id) VALUES ($1, $2)',
      [id, roleId],
    );
    await expectPgError(
      db.pool.query('INSERT INTO admin_invitation_roles (invitation_id, role_id) VALUES ($1, $2)', [
        id,
        roleId,
      ]),
      { code: UNIQUE_VIOLATION, constraint: 'admin_invitation_roles_key' },
    );
  });

  it('I-5 deleting a role drops it from invitations; deleting an invitation drops its roles', async () => {
    const id = (await invite(email())).rows[0].id as string;
    const roleId = await role();
    await db.pool.query(
      'INSERT INTO admin_invitation_roles (invitation_id, role_id) VALUES ($1, $2)',
      [id, roleId],
    );
    await db.pool.query('DELETE FROM roles WHERE id = $1', [roleId]);
    const left = await db.pool.query(
      'SELECT 1 FROM admin_invitation_roles WHERE invitation_id = $1',
      [id],
    );
    expect(left.rowCount).toBe(0);

    const second = (await invite(email())).rows[0].id as string;
    const another = await role();
    await db.pool.query(
      'INSERT INTO admin_invitation_roles (invitation_id, role_id) VALUES ($1, $2)',
      [second, another],
    );
    await db.pool.query('DELETE FROM admin_invitations WHERE id = $1', [second]);
    expect(
      (
        await db.pool.query('SELECT 1 FROM admin_invitation_roles WHERE invitation_id = $1', [
          second,
        ])
      ).rowCount,
    ).toBe(0);
  });
});

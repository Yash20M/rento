import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { type Factories, createFactories } from '../factories';
import { expectPgError } from '../support/db/pg-assert';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';

let db: TestDatabase;
let f: Factories;
beforeAll(async () => {
  db = await createTestDatabase();
  f = createFactories(db.db);
});
afterAll(async () => {
  await db.drop();
});

const insert = (
  userId: string,
  overrides: {
    purpose?: string;
    hash?: string;
    used?: string | null;
    revoked?: string | null;
  } = {},
) =>
  db.pool.query(
    `INSERT INTO auth_tokens (user_id, purpose, token_hash, email, expires_at, used_at, revoked_at)
     VALUES ($1, $2, $3, 'a@example.com', '2030-01-02T00:00:00Z', $4, $5)`,
    [
      userId,
      overrides.purpose ?? 'password_reset',
      overrides.hash ?? randomUUID(),
      overrides.used ?? null,
      overrides.revoked ?? null,
    ],
  );

describe('auth_tokens', () => {
  it('D-01a accepts both purposes', async () => {
    const user = await f.user();
    await insert(user.id, { purpose: 'password_reset' });
    await insert(user.id, { purpose: 'email_verification' });
  });

  it('D-01b rejects an unknown purpose', async () => {
    const user = await f.user();
    await expectPgError(insert(user.id, { purpose: 'magic_login' }), {
      code: '23514',
      constraint: 'auth_tokens_purpose_check',
    });
  });

  it('D-01c token hashes are unique', async () => {
    const user = await f.user();
    const hash = randomUUID();
    await insert(user.id, { hash });
    await expectPgError(insert(user.id, { hash }), {
      code: '23505',
      constraint: 'auth_tokens_token_hash_key',
    });
  });

  it('D-01d a token cannot be both used and revoked', async () => {
    const user = await f.user();
    await expectPgError(
      insert(user.id, { used: '2030-01-01T00:00:00Z', revoked: '2030-01-01T00:00:00Z' }),
      { code: '23514', constraint: 'auth_tokens_used_xor_revoked' },
    );
    await insert(user.id, { used: '2030-01-01T00:00:00Z' });
    await insert(user.id, { revoked: '2030-01-01T00:00:00Z' });
  });

  it('D-01e needs an existing user', async () => {
    await expectPgError(insert(randomUUID()), { code: '23503' });
  });
});

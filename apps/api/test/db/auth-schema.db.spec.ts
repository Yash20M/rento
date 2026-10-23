import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { type Factories, createFactories } from '../factories';
import { expectPgError } from '../support/db/pg-assert';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';

const CHECK_VIOLATION = '23514';
const UNIQUE_VIOLATION = '23505';

let db: TestDatabase;
let f: Factories;
beforeAll(async () => {
  db = await createTestDatabase();
  f = createFactories(db.db);
});
afterAll(async () => {
  await db.drop();
});

const addIdentity = (
  userId: string,
  provider: string,
  subject: string,
  passwordHash: string | null,
) =>
  db.pool.query(
    `INSERT INTO user_identities (user_id, provider, provider_subject, password_hash)
     VALUES ($1, $2, $3, $4)`,
    [userId, provider, subject, passwordHash],
  );

describe('user_identities', () => {
  it('D-01 a provider account can belong to only one user', async () => {
    const [a, b] = [await f.user(), await f.user()];
    const subject = `google-sub-${randomUUID()}`;
    await addIdentity(a.id, 'google', subject, null);

    await expectPgError(addIdentity(b.id, 'google', subject, null), {
      code: UNIQUE_VIOLATION,
      constraint: 'user_identities_provider_subject_key',
    });
  });

  it('D-02 one identity per provider per user; different providers are fine', async () => {
    const user = await f.user();
    await addIdentity(user.id, 'google', `g-${randomUUID()}`, null);
    await expectPgError(addIdentity(user.id, 'google', `g-${randomUUID()}`, null), {
      code: UNIQUE_VIOLATION,
      constraint: 'user_identities_user_provider_key',
    });
    await addIdentity(user.id, 'apple', `a-${randomUUID()}`, null);
  });

  it('D-03 a password hash exists exactly for the password provider', async () => {
    const user = await f.user();
    await expectPgError(addIdentity(user.id, 'password', user.id, null), {
      code: CHECK_VIOLATION,
      constraint: 'identity_password_hash_only_for_password',
    });
    await expectPgError(addIdentity(user.id, 'google', `g-${randomUUID()}`, '$argon2id$x'), {
      code: CHECK_VIOLATION,
      constraint: 'identity_password_hash_only_for_password',
    });
    await addIdentity(user.id, 'password', user.id, '$argon2id$v=19$m=19456,t=2,p=1$abc$def');
  });

  it('D-03b only known providers are allowed', async () => {
    const user = await f.user();
    await expectPgError(addIdentity(user.id, 'myspace', 'x', null), {
      code: CHECK_VIOLATION,
      constraint: 'user_identities_provider_check',
    });
  });

  it('D-03c an identity needs an existing user', async () => {
    await expectPgError(addIdentity(randomUUID(), 'google', 'x', null), { code: '23503' });
  });
});

describe('refresh_tokens', () => {
  const insertToken = (userId: string, hash: string, expires: string, familyExpires: string) =>
    db.pool.query(
      `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at, family_expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, randomUUID(), hash, expires, familyExpires],
    );

  it('D-04 token hashes are unique', async () => {
    const user = await f.user();
    const hash = randomUUID().replaceAll('-', '');
    await insertToken(user.id, hash, '2030-02-01T00:00:00Z', '2030-02-01T00:00:00Z');
    await expectPgError(
      insertToken(user.id, hash, '2030-02-01T00:00:00Z', '2030-02-01T00:00:00Z'),
      {
        code: UNIQUE_VIOLATION,
        constraint: 'refresh_tokens_token_hash_key',
      },
    );
  });

  it('D-05 a token can never outlive its family', async () => {
    const user = await f.user();
    await expectPgError(
      insertToken(user.id, randomUUID(), '2030-03-01T00:00:00Z', '2030-02-01T00:00:00Z'),
      { code: CHECK_VIOLATION, constraint: 'refresh_tokens_expiry_within_family' },
    );
    await insertToken(user.id, randomUUID(), '2030-02-01T00:00:00Z', '2030-02-01T00:00:00Z');
  });

  it('D-05b replaced_by must reference an existing token', async () => {
    const user = await f.user();
    await expectPgError(
      db.pool.query(
        `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at, family_expires_at, replaced_by)
         VALUES ($1, $2, $3, now(), now(), $4)`,
        [user.id, randomUUID(), randomUUID(), randomUUID()],
      ),
      { code: '23503' },
    );
  });
});

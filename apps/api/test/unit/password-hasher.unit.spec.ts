import { describe, expect, it } from 'vitest';
import { PasswordHasher } from '../../src/modules/auth-users/services/password-hasher';

const hasher = new PasswordHasher();

describe('PasswordHasher (Argon2id)', () => {
  it('U-04 verifies the right password and rejects a wrong one', async () => {
    const hash = await hasher.hash('correct horse battery staple');
    expect(await hasher.verify(hash, 'correct horse battery staple')).toBe(true);
    expect(await hasher.verify(hash, 'correct horse battery stapl3')).toBe(false);
  });

  it('U-05 stores an argon2id PHC string with OWASP parameters and a fresh salt each time', async () => {
    const [a, b] = await Promise.all([
      hasher.hash('same-password-123'),
      hasher.hash('same-password-123'),
    ]);
    expect(a).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(a).not.toBe(b);
    expect(a).not.toContain('same-password-123');
  });

  it.each(['', 'not-a-hash', '$argon2id$garbage', '$2b$10$abcdefghijklmnopqrstuv'])(
    'U-06 verify() returns false (never throws) for malformed hash %j',
    async (bad) => {
      await expect(hasher.verify(bad, 'whatever-password')).resolves.toBe(false);
    },
  );

  it('U-06b verify() with an empty password is false, not an error', async () => {
    const hash = await hasher.hash('some-password-123');
    await expect(hasher.verify(hash, '')).resolves.toBe(false);
  });
});

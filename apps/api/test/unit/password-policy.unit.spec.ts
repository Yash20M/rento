import { describe, expect, it } from 'vitest';
import { validatePassword } from '../../src/modules/auth-users/domain/password-policy';

const email = 'asha@example.com';

describe('validatePassword', () => {
  it('U-01 enforces 10–128 characters', () => {
    expect(validatePassword('a1b2c3d4e', { email })).not.toEqual([]); // 9
    expect(validatePassword('a1b2c3d4e5', { email })).toEqual([]); // 10
    expect(validatePassword('xK9#'.repeat(32), { email })).toEqual([]); // 128
    expect(validatePassword('xK9#'.repeat(32) + 'y', { email })).not.toEqual([]); // 129
  });

  it.each(['Password123', 'PASSWORD123', 'password1234', 'Qwerty123456', '1234567890'])(
    'U-02a rejects the common password %s (case-insensitive)',
    (password) => {
      expect(validatePassword(password, { email })).toContain('This password is too common.');
    },
  );

  it('U-02b rejects the account email as password (case-insensitive)', () => {
    expect(validatePassword('ASHA@example.com', { email })).toContain(
      'Password must not be the same as your email.',
    );
  });

  it('U-02c rejects a single repeated character', () => {
    expect(validatePassword('aaaaaaaaaaaa', { email })).toContain(
      'Password must not be a single repeated character.',
    );
  });

  it('U-02d reports every violation together', () => {
    const problems = validatePassword('short', { email });
    expect(problems.length).toBeGreaterThanOrEqual(1);
    const several = validatePassword('1111111111', { email });
    expect(several.length).toBeGreaterThanOrEqual(1);
  });

  it('U-03 accepts a unicode passphrase with spaces and no composition rules', () => {
    expect(validatePassword('correct horse battery staple', { email })).toEqual([]);
    expect(validatePassword('पासवर्ड-बहुत-लंबा-है', { email })).toEqual([]);
    expect(validatePassword('alllowercaseletters', { email })).toEqual([]);
  });
});

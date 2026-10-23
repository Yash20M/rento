/**
 * Password policy (README §15, NIST-style): length matters, composition rules do not. Pure — no framework,
 * no I/O. Returns every violated rule so the API can report them together.
 */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128; // also bounds Argon2 work per request

/** A small deny-list of the most common passwords that satisfy the length rule. Compared case-insensitively. */
const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  '1234567890',
  '0123456789',
  '12345678910',
  '123456789012',
  '1234567890123',
  '0987654321',
  '1q2w3e4r5t',
  '1qaz2wsx3edc',
  'qwertyuiop',
  'qwerty1234',
  'qwerty12345',
  'qwerty123456',
  'qwertyuiop123',
  'asdfghjkl',
  'asdfghjkl123',
  'zxcvbnm123',
  'password',
  'password1',
  'password12',
  'password123',
  'password1234',
  'password12345',
  'password123456',
  'passw0rd123',
  'p@ssw0rd123',
  'p@ssword123',
  'iloveyou123',
  'iloveyou1234',
  'letmein1234',
  'letmein123',
  'welcome123',
  'welcome1234',
  'welcome12345',
  'admin12345',
  'admin123456',
  'administrator',
  'changeme123',
  'abcd123456',
  'abc1234567',
  'abcdefghij',
  'abcdefgh123',
  'monkey1234',
  'dragon1234',
  'football123',
  'baseball123',
  'superman123',
  'trustno1234',
  'sunshine123',
  'princess123',
  'rento12345',
  'rento123456',
]);

export interface PasswordContext {
  email: string;
}

export function validatePassword(password: string, context: PasswordContext): string[] {
  const problems: string[] = [];
  const length = [...password].length;

  if (length < PASSWORD_MIN_LENGTH) {
    problems.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
  if (length > PASSWORD_MAX_LENGTH) {
    problems.push(`Password must be at most ${PASSWORD_MAX_LENGTH} characters.`);
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    problems.push('This password is too common.');
  }
  if (password.toLowerCase() === context.email.toLowerCase()) {
    problems.push('Password must not be the same as your email.');
  }
  if (length > 0 && new Set(password).size === 1) {
    problems.push('Password must not be a single repeated character.');
  }
  return problems;
}

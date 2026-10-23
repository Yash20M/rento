import { describe, expect, it } from 'vitest';
import { parseCommand } from '../../src/cli/args';
import { formatOutcome } from '../../src/cli/format';

describe('cli argument parsing', () => {
  it('C-1 parses a valid bootstrap command and normalises the email', () => {
    expect(
      parseCommand([
        'bootstrap-super-admin',
        '--email',
        '  Admin@Example.COM ',
        '--name',
        ' Asha ',
      ]),
    ).toEqual({
      kind: 'bootstrap-super-admin',
      input: { email: 'admin@example.com', name: 'Asha', forceAdditional: false },
    });
  });

  it('C-2 --force-additional is an explicit flag, in any position', () => {
    const parsed = parseCommand([
      'bootstrap-super-admin',
      '--force-additional',
      '--email',
      'a@b.co',
    ]);
    expect(parsed).toMatchObject({ input: { forceAdditional: true, email: 'a@b.co' } });
  });

  it.each([
    [[], /No command/],
    [['wipe-everything'], /Unknown command/],
    [['bootstrap-super-admin'], /--email is required/],
    [['bootstrap-super-admin', '--email'], /needs a value/],
    [['bootstrap-super-admin', '--email', '--force-additional'], /needs a value/],
    [['bootstrap-super-admin', '--email', 'not-an-email'], /valid email/],
    [['bootstrap-super-admin', '--email', `${'a'.repeat(250)}@b.co`], /valid email/],
    [['bootstrap-super-admin', '--email', 'a@b.co', '--name', '  '], /--name/],
    [['bootstrap-super-admin', '--email', 'a@b.co', '--password', 'x'], /Unknown option/],
    [['bootstrap-super-admin', '--email', 'a@b.co', '--force'], /Unknown option/],
  ])('C-3 %j is a usage error', (argv, message) => {
    const parsed = parseCommand(argv);
    expect(parsed.kind).toBe('usage');
    expect((parsed as { message: string }).message).toMatch(message);
  });

  it('C-4 there is deliberately no way to pass a password on the command line', () => {
    expect(
      parseCommand(['bootstrap-super-admin', '--email', 'a@b.co', '--password', 'hunter2']).kind,
    ).toBe('usage');
  });
});

describe('cli output', () => {
  it('C-5 a new account prints the one-time link and says it is single use', () => {
    const { text, exitCode } = formatOutcome({
      kind: 'created',
      userId: 'u',
      email: 'admin@example.com',
      setup: { link: 'https://app.example/reset-password?token=abc', expiresInMinutes: 60 },
    });
    expect(exitCode).toBe(0);
    expect(text).toContain('Created account admin@example.com');
    expect(text).toContain('https://app.example/reset-password?token=abc');
    expect(text).toMatch(/works once/);
    expect(text).not.toMatch(/^\s*password\s*[:=]/im); // the command never shows a password
  });

  it('C-6 no link is printed when the account already has a password', () => {
    const { text, exitCode } = formatOutcome({ kind: 'promoted', userId: 'u', email: 'a@b.co' });
    expect(exitCode).toBe(0);
    expect(text).toBe('Existing account a@b.co is now a Super Admin.');
  });

  it('C-7 "already" is a successful no-op', () => {
    const { text, exitCode } = formatOutcome({ kind: 'already', userId: 'u', email: 'a@b.co' });
    expect(exitCode).toBe(0);
    expect(text).toContain('nothing changed');
  });

  it('C-8 refusals exit non-zero and explain how to proceed', () => {
    const exists = formatOutcome({ kind: 'refused', reason: 'super_admin_exists' });
    expect(exists.exitCode).toBe(1);
    expect(exists.text).toContain('--force-additional');
    const inactive = formatOutcome({ kind: 'refused', reason: 'account_not_active' });
    expect(inactive.exitCode).toBe(1);
    expect(inactive.text).toContain('suspended');
  });
});

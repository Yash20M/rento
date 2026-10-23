import type { BootstrapInput } from '../modules/access-control/services/super-admin-bootstrap';

export type ParsedCommand =
  { kind: 'bootstrap-super-admin'; input: BootstrapInput } | { kind: 'usage'; message: string };

export const usage = (): string =>
  [
    'Usage: pnpm --filter api cli <command> [options]',
    '',
    'Commands:',
    '  bootstrap-super-admin --email <address> [--name <display name>] [--force-additional]',
    '      Creates the first Super Admin (or promotes an existing account) and prints a one-time link',
    '      for choosing a password. Refuses if a Super Admin already exists, unless --force-additional.',
  ].join('\n');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Strict parser: unknown options, missing values and malformed emails are usage errors (exit code 2). */
export function parseCommand(argv: readonly string[]): ParsedCommand {
  const [command, ...rest] = argv;
  if (command !== 'bootstrap-super-admin') {
    return {
      kind: 'usage',
      message: command === undefined ? 'No command given.' : `Unknown command "${command}".`,
    };
  }

  let email: string | undefined;
  let name: string | undefined;
  let forceAdditional = false;
  for (let i = 0; i < rest.length; i += 1) {
    const option = rest[i];
    if (option === '--force-additional') {
      forceAdditional = true;
    } else if (option === '--email' || option === '--name') {
      const value = rest[i + 1];
      if (value === undefined || value.startsWith('--')) {
        return { kind: 'usage', message: `${option} needs a value.` };
      }
      i += 1;
      if (option === '--email') email = value;
      else name = value;
    } else {
      return { kind: 'usage', message: `Unknown option "${String(option)}".` };
    }
  }

  if (email === undefined) return { kind: 'usage', message: '--email is required.' };
  email = email.trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) {
    return { kind: 'usage', message: '--email must be a valid email address.' };
  }
  const trimmedName = name?.trim();
  if (trimmedName !== undefined && (trimmedName === '' || trimmedName.length > 100)) {
    return { kind: 'usage', message: '--name must be 1–100 characters.' };
  }
  return {
    kind: 'bootstrap-super-admin',
    input: { email, name: trimmedName, forceAdditional },
  };
}

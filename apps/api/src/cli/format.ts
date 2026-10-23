import type { BootstrapOutcome } from '../modules/access-control/services/super-admin-bootstrap';

/**
 * Human-readable result. The setup link is the ONLY secret printed (it is the point of the command); a password is
 * never chosen, stored or shown.
 */
export function formatOutcome(outcome: BootstrapOutcome): { text: string; exitCode: number } {
  if (outcome.kind === 'refused') {
    return {
      exitCode: 1,
      text:
        outcome.reason === 'super_admin_exists'
          ? 'Refused: a Super Admin already exists. Use --force-additional to add another one on purpose.'
          : 'Refused: that account is suspended or deleted. Reactivate it first.',
    };
  }

  const headline = {
    created: `Created account ${outcome.email} and made it a Super Admin.`,
    promoted: `Existing account ${outcome.email} is now a Super Admin.`,
    already: `${outcome.email} is already a Super Admin; nothing changed.`,
  }[outcome.kind];

  if (!outcome.setup) return { exitCode: 0, text: headline };
  return {
    exitCode: 0,
    text: [
      headline,
      '',
      `This account has no password yet. Open this one-time link to choose one (valid ${outcome.setup.expiresInMinutes} minutes, works once):`,
      '',
      `  ${outcome.setup.link}`,
      '',
      'Treat the link like a password: anyone holding it can set the password. Run the command again to get a new link.',
    ].join('\n'),
  };
}

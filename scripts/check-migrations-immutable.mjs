// ADR-005: node-pg-migrate keeps no checksums, so editing or deleting an already-applied migration would go
// unnoticed. This guard compares apps/api/db/migrations with a base git ref and fails on any modified or deleted
// file (new files are fine). Usage: node scripts/check-migrations-immutable.mjs [--base <ref>]
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MIGRATIONS_DIR = 'apps/api/db/migrations';
const normalize = (text) => text.replaceAll('\r\n', '\n');

function git(repoRoot, args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

function refExists(repoRoot, ref) {
  try {
    git(repoRoot, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {{ repoRoot: string, base?: string }} options
 * @returns {{ ok: boolean, problems: string[], notice?: string }}
 */
export function checkMigrations({ repoRoot, base }) {
  const ref = base ?? process.env.MIGRATIONS_BASE_REF ?? 'origin/main';
  if (!refExists(repoRoot, ref)) {
    return {
      ok: true,
      problems: [],
      notice: `base ref "${ref}" not found (no commits yet, or first push) — nothing to compare against.`,
    };
  }

  const files = git(repoRoot, ['ls-tree', '-r', '--name-only', ref, '--', MIGRATIONS_DIR])
    .split('\n')
    .filter(Boolean);

  const problems = [];
  for (const file of files) {
    const absolute = path.join(repoRoot, file);
    if (!existsSync(absolute)) {
      problems.push(`${file} was deleted (or renamed). Applied migrations must never be removed.`);
      continue;
    }
    const before = normalize(git(repoRoot, ['show', `${ref}:${file}`]));
    const after = normalize(readFileSync(absolute, 'utf8'));
    if (before !== after) {
      problems.push(
        `${file} was modified. Applied migrations are immutable — fix forward with a new numbered migration.`,
      );
    }
  }
  return { ok: problems.length === 0, problems };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const baseIndex = process.argv.indexOf('--base');
  const base = baseIndex === -1 ? undefined : process.argv[baseIndex + 1];
  const repoRoot = path.resolve(import.meta.dirname, '..');
  const result = checkMigrations({ repoRoot, base });
  if (result.notice) console.log(`migrations guard: ${result.notice}`);
  if (!result.ok) {
    console.error(
      'migrations guard FAILED (ADR-005):\n' + result.problems.map((p) => `  - ${p}`).join('\n'),
    );
    process.exit(1);
  }
  console.log('migrations guard: ok');
}

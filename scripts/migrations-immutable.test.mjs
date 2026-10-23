import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { checkMigrations } from './check-migrations-immutable.mjs';

const DIR = 'apps/api/db/migrations';
const git = (cwd, ...args) =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@t',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@t',
    },
  });

/** A throw-away git repository whose `base` branch holds migration 0001. */
function makeRepo() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'rento-mig-'));
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'core.autocrlf', 'false');
  mkdirSync(path.join(root, DIR), { recursive: true });
  writeFileSync(
    path.join(root, DIR, '0001_baseline.sql'),
    '-- Up Migration\nCREATE TABLE a (id int);\n',
  );
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'base');
  return root;
}

describe('checkMigrations (ADR-005: applied migrations are immutable)', () => {
  let root;
  before(() => {
    root = makeRepo();
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  const reset = () => git(root, 'checkout', '-q', '--', '.');

  it('M-01 unchanged migrations pass', () => {
    const result = checkMigrations({ repoRoot: root, base: 'HEAD' });
    assert.equal(result.ok, true);
    assert.deepEqual(result.problems, []);
  });

  it('M-02 a modified migration fails and names the file', () => {
    writeFileSync(
      path.join(root, DIR, '0001_baseline.sql'),
      '-- Up Migration\nCREATE TABLE a (id bigint);\n',
    );
    const result = checkMigrations({ repoRoot: root, base: 'HEAD' });
    reset();
    assert.equal(result.ok, false);
    assert.match(result.problems.join('\n'), /0001_baseline\.sql.*modified/i);
  });

  it('M-03 a deleted migration fails', () => {
    unlinkSync(path.join(root, DIR, '0001_baseline.sql'));
    const result = checkMigrations({ repoRoot: root, base: 'HEAD' });
    reset();
    assert.equal(result.ok, false);
    assert.match(result.problems.join('\n'), /0001_baseline\.sql.*deleted/i);
  });

  it('M-04 adding a new migration is fine', () => {
    const added = path.join(root, DIR, '0002_next.sql');
    writeFileSync(added, '-- Up Migration\nCREATE TABLE b (id int);\n');
    const result = checkMigrations({ repoRoot: root, base: 'HEAD' });
    unlinkSync(added);
    assert.equal(result.ok, true);
  });

  it('M-05 a line-ending-only difference (CRLF checkout) is not a modification', () => {
    writeFileSync(
      path.join(root, DIR, '0001_baseline.sql'),
      '-- Up Migration\r\nCREATE TABLE a (id int);\r\n',
    );
    const result = checkMigrations({ repoRoot: root, base: 'HEAD' });
    reset();
    assert.equal(result.ok, true);
  });

  it('M-06 a base ref that does not exist passes with a notice (first push)', () => {
    const result = checkMigrations({ repoRoot: root, base: 'origin/main' });
    assert.equal(result.ok, true);
    assert.match(result.notice ?? '', /origin\/main.*not found|no base/i);
  });

  it('M-07 renaming a migration counts as deleting the old one', () => {
    renameSync(path.join(root, DIR, '0001_baseline.sql'), path.join(root, DIR, '0001_renamed.sql'));
    const result = checkMigrations({ repoRoot: root, base: 'HEAD' });
    git(root, 'checkout', '-q', '--', '.');
    unlinkSync(path.join(root, DIR, '0001_renamed.sql'));
    assert.equal(result.ok, false);
    assert.match(result.problems.join('\n'), /0001_baseline\.sql.*deleted/i);
  });

  it('a repository without any commit passes with a notice', () => {
    const empty = mkdtempSync(path.join(os.tmpdir(), 'rento-empty-'));
    try {
      git(empty, 'init', '-q', '-b', 'main');
      const result = checkMigrations({ repoRoot: empty, base: 'origin/main' });
      assert.equal(result.ok, true);
      assert.ok(result.notice);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

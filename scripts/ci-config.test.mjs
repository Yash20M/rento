import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { parse } from 'yaml';
import { STEPS } from './verify-steps.mjs';

const root = path.resolve(import.meta.dirname, '..');
const read = (...p) => readFileSync(path.join(root, ...p), 'utf8');
const workflowText = read('.github', 'workflows', 'ci.yml');
const workflow = parse(workflowText);
const rootPackage = JSON.parse(read('package.json'));

/** Every `run:` command line in the workflow (multi-line scripts split into lines). */
const runLines = Object.values(workflow.jobs)
  .flatMap((job) => job.steps ?? [])
  .flatMap((step) => (typeof step.run === 'string' ? step.run.split('\n') : []))
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));

const allSteps = Object.values(workflow.jobs).flatMap((job) => job.steps ?? []);

// workspace package name → scripts
const workspaces = new Map();
for (const group of ['apps', 'packages']) {
  for (const dir of readdirSync(path.join(root, group))) {
    try {
      const pkg = JSON.parse(read(group, dir, 'package.json'));
      workspaces.set(pkg.name, pkg.scripts ?? {});
    } catch {
      /* not a node package (e.g. apps/mobile) */
    }
  }
}
const findWorkspace = (name) =>
  [...workspaces.keys()].find((key) => key === name || key === `@rento/${name}`);

describe('.github/workflows/ci.yml', () => {
  it('W-01 runs on pull requests and pushes to main', () => {
    assert.ok('pull_request' in workflow.on);
    assert.deepEqual(workflow.on.push.branches, ['main']);
  });

  it('W-02 defines the expected jobs', () => {
    assert.deepEqual(Object.keys(workflow.jobs).sort(), [
      'admin',
      'api',
      'ci-success',
      'mobile',
      'static',
    ]);
  });

  it('W-03 ci-success is the single aggregate gate: needs every job, always runs, checks results', () => {
    const gate = workflow.jobs['ci-success'];
    const others = Object.keys(workflow.jobs).filter((name) => name !== 'ci-success');
    assert.deepEqual([...gate.needs].sort(), others.sort());
    assert.equal(gate.if, 'always()');
    const script = JSON.stringify(gate.steps);
    assert.match(script, /needs\.\*\.result/);
    assert.match(script, /success/);
  });

  it('W-04 every pnpm command refers to a script that exists', () => {
    const pnpmLines = runLines.filter((line) => /^pnpm\b/.test(line));
    assert.ok(pnpmLines.length > 10);
    for (const line of pnpmLines) {
      const tokens = line
        .replace(/\s+--\s.*$/, '')
        .split(/\s+/)
        .slice(1);
      if (tokens[0] === 'install') continue;
      if (tokens[0] === '--filter') {
        const pkg = findWorkspace(tokens[1]);
        assert.ok(pkg, `unknown workspace in: ${line}`);
        if (tokens[2] === 'exec') continue;
        assert.ok(
          tokens[2] in workspaces.get(pkg),
          `missing script "${tokens[2]}" in ${pkg} for: ${line}`,
        );
      } else {
        assert.ok(
          tokens[0] in rootPackage.scripts,
          `missing root script "${tokens[0]}" for: ${line}`,
        );
      }
    }
  });

  it('W-05 nothing can be skipped, retried or swallowed', () => {
    for (const forbidden of [
      /continue-on-error/,
      /--passWithNoTests/,
      /\|\|\s*true/,
      /retry/i,
      /--retries/,
      /\.only\b/,
    ]) {
      assert.doesNotMatch(workflowText, forbidden);
    }
  });

  it('W-06 read-only permissions and pinned action versions', () => {
    assert.deepEqual(workflow.permissions, { contents: 'read' });
    const uses = allSteps.map((step) => step.uses).filter(Boolean);
    assert.ok(uses.length > 0);
    for (const action of uses)
      assert.match(action, /@v\d+(\.\d+){0,2}$/, `unpinned action: ${action}`);
  });

  it('W-07 installs are frozen; Flutter is pinned to the version used locally', () => {
    const installs = runLines.filter((line) => /^pnpm install\b/.test(line));
    assert.ok(installs.length >= 3);
    for (const line of installs) assert.match(line, /--frozen-lockfile/);

    const flutterStep = allSteps.find((step) => step.uses?.startsWith('subosito/flutter-action'));
    assert.equal(String(flutterStep.with['flutter-version']), '3.29.2');
    assert.match(read('apps', 'mobile', 'README.md'), /Flutter 3\.29/);
  });

  it('W-08 every gate of `pnpm verify` is also run by the workflow', () => {
    for (const step of STEPS) {
      assert.ok(
        runLines.some((line) => line.startsWith(step.command)),
        `workflow is missing the "${step.id}" gate: ${step.command}`,
      );
    }
  });

  it('W-09 the static job fetches full history (needed by the migration guard)', () => {
    const checkout = workflow.jobs.static.steps.find((step) =>
      step.uses?.startsWith('actions/checkout'),
    );
    assert.equal(checkout.with['fetch-depth'], 0);
  });

  it('W-10 references no repository secrets', () => {
    assert.doesNotMatch(workflowText, /secrets\./);
  });

  it('uses Node from .nvmrc and caches the pnpm store', () => {
    const setups = allSteps.filter((step) => step.uses?.startsWith('actions/setup-node'));
    assert.ok(setups.length >= 3);
    for (const setup of setups) {
      assert.equal(setup.with['node-version-file'], '.nvmrc');
      assert.equal(setup.with.cache, 'pnpm');
    }
  });

  it('cancels superseded runs of the same ref', () => {
    assert.ok(workflow.concurrency.group.includes('github.ref'));
    assert.ok(workflow.concurrency['cancel-in-progress']);
  });

  it('runs the whole API suite including the concurrency gate', () => {
    for (const script of ['test:unit', 'test:db', 'test:api', 'test:concurrency']) {
      assert.ok(
        runLines.some((line) => line === `pnpm --filter api ${script}`),
        script,
      );
    }
  });
});

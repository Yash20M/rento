// `pnpm verify` — runs every applicable quality gate and prints a summary.
//   pnpm verify                      all gates (needs Docker, a browser, the Flutter SDK)
//   pnpm verify --fast               skip gates that need Docker or a browser
//   pnpm verify --parallel           run the lanes (static / api / admin / mobile) side by side, two at a time (--jobs N), concurrency suite last
//   pnpm verify --only lint,api:unit | --skip admin:e2e | --keep-going | --list
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import {
  PlanError,
  buildPlan,
  exitCodeFor,
  formatSummary,
  preflight,
  runParallel,
  runPlan,
  STEPS,
} from './verify-steps.mjs';

const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);

const flag = (name) => args.includes(name);
const list = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : (args[index + 1] ?? '').split(',').filter(Boolean);
};

if (flag('--help') || flag('-h')) {
  console.log(
    'usage: pnpm verify [--fast] [--only id,id] [--skip id,id] [--keep-going] [--parallel [--jobs N]] [--list]',
  );
  console.log(`steps: ${STEPS.map((s) => s.id).join(', ')}`);
  process.exit(0);
}

let plan;
try {
  plan = buildPlan({ fast: flag('--fast'), only: list('--only'), skip: list('--skip') ?? [] });
} catch (error) {
  if (error instanceof PlanError) {
    console.error(error.message);
    process.exit(2);
  }
  throw error;
}

if (flag('--list')) {
  for (const step of plan) {
    const needs = step.needs.length ? `  [needs ${step.needs.join(', ')}]` : '';
    console.log(`${step.id.padEnd(16)} ${step.command}${needs}`);
  }
  process.exit(0);
}

const probe = (command) =>
  spawnSync(command, { shell: true, stdio: 'ignore', timeout: 30_000 }).status === 0;
const problems = preflight(plan, {
  docker: probe('docker info'),
  flutter: probe('flutter --version'),
});
if (problems.length > 0) {
  console.error('verify cannot start:\n' + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(2);
}

// Commands are static strings from verify-steps.mjs (never user input), so running them through a shell is safe
// and is required on Windows where pnpm is a .cmd shim.
const parallel = flag('--parallel');
const execute = (step) =>
  new Promise((resolve) => {
    console.log(`\n▶ ${step.id} — ${step.label}\n  $ ${step.command}`);
    const child = spawn(step.command, {
      cwd: root,
      shell: true,
      stdio: parallel ? ['inherit', 'pipe', 'pipe'] : 'inherit',
    });
    if (parallel) {
      // Lanes interleave, so every output line carries its step id.
      for (const stream of [child.stdout, child.stderr]) {
        let rest = '';
        stream.on('data', (chunk) => {
          const lines = (rest + chunk.toString()).split(/\r?\n/);
          rest = lines.pop() ?? '';
          for (const line of lines) if (line.trim()) console.log(`[${step.id}] ${line}`);
        });
        stream.on('end', () => rest.trim() && console.log(`[${step.id}] ${rest}`));
      }
    }
    child.on('error', () => resolve({ code: 1 }));
    child.on('exit', (code) => resolve({ code: code ?? 1 }));
  });

const jobs = Number(list('--jobs')?.[0] ?? 2);
const run = flag('--parallel') ? (p, e, o) => runParallel(p, e, { ...o, jobs }) : runPlan;
const results = await run(plan, execute, { keepGoing: flag('--keep-going') });
console.log(formatSummary(results));
process.exit(exitCodeFor(results));

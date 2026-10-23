// The gate list behind `pnpm verify` (plan §5.2) and the pure logic around it. Kept free of I/O so it is unit-tested
// (scripts/verify.test.mjs). The same commands run in .github/workflows/ci.yml — scripts/ci-config.test.mjs fails if
// the workflow and this list drift apart.

/**
 * @typedef {{ id: string, label: string, command: string, needs: Array<'docker'|'flutter'|'browser'>, lane?: string }} Step
 */

/** Ordered cheapest-first so a broken build fails fast (README §16: lint → unit → DB → API → contracts → apps). */
/** @type {Step[]} */
const DEFINITIONS = [
  { id: 'lint', label: 'ESLint + Prettier', command: 'pnpm lint', needs: [] },
  { id: 'typecheck', label: 'TypeScript (all packages)', command: 'pnpm typecheck', needs: [] },
  {
    id: 'scripts',
    label: 'Tooling self-tests (verify, migrations guard, CI config)',
    command: 'pnpm test:scripts',
    needs: [],
  },
  {
    id: 'migrations',
    label: 'Applied migrations are immutable',
    command: 'pnpm check:migrations',
    needs: [],
  },
  { id: 'api:unit', label: 'API unit tests', command: 'pnpm --filter api test:unit', needs: [] },
  {
    id: 'contracts',
    label: 'OpenAPI contract drift + client compiles',
    command: 'pnpm contracts:check',
    needs: [],
  },
  {
    id: 'contracts:test',
    label: 'Contract tooling tests',
    command: 'pnpm --filter @rento/contracts test',
    needs: [],
  },
  {
    id: 'admin:unit',
    label: 'Admin component tests',
    command: 'pnpm --filter admin test',
    needs: [],
  },
  {
    id: 'mobile:format',
    label: 'Flutter formatting',
    command: 'pnpm mobile:format:check',
    needs: ['flutter'],
  },
  {
    id: 'mobile:analyze',
    label: 'Flutter analyze',
    command: 'pnpm mobile:analyze',
    needs: ['flutter'],
  },
  {
    id: 'mobile:test',
    label: 'Flutter unit + widget tests',
    command: 'pnpm mobile:test',
    needs: ['flutter'],
  },
  {
    id: 'mobile:codegen',
    label: 'Flutter generated code is up to date',
    command: 'pnpm mobile:codegen:check',
    needs: ['flutter'],
  },
  {
    id: 'api:db',
    label: 'API database tests (PostGIS container)',
    command: 'pnpm --filter api test:db',
    needs: ['docker'],
  },
  {
    id: 'api:http',
    label: 'API HTTP tests (PostGIS container)',
    command: 'pnpm --filter api test:api',
    needs: ['docker'],
  },
  {
    id: 'api:concurrency',
    label: 'Booking concurrency suite (PostGIS container)',
    command: 'pnpm --filter api test:concurrency',
    needs: ['docker'],
  },
  {
    id: 'admin:e2e',
    label: 'Admin end-to-end (Playwright)',
    command: 'pnpm --filter admin test:e2e',
    needs: ['browser'],
  },
];

/** Which lane each step belongs to (see `runParallel`). */
export const LANES = {
  lint: 'static',
  typecheck: 'static',
  scripts: 'static',
  migrations: 'static',
  contracts: 'static',
  'contracts:test': 'static',
  'api:unit': 'api',
  'api:db': 'api',
  'api:http': 'api',
  'api:concurrency': 'quiet',
  'admin:unit': 'admin',
  'admin:e2e': 'admin',
  'mobile:format': 'mobile',
  'mobile:analyze': 'mobile',
  'mobile:test': 'mobile',
  'mobile:codegen': 'mobile',
};

/** Longest lanes first, so the last lane to finish is a short one. */
const LANE_ORDER = ['api', 'mobile', 'static', 'admin'];

/** @type {Step[]} */
export const STEPS = DEFINITIONS.map((step) => ({ ...step, lane: LANES[step.id] }));

export class PlanError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PlanError';
  }
}

/**
 * @param {{ fast?: boolean, only?: string[], skip?: string[] }} options
 * @returns {Step[]}
 */
export function buildPlan({ fast = false, only, skip = [] } = {}) {
  const known = new Set(STEPS.map((step) => step.id));
  for (const id of [...(only ?? []), ...skip]) {
    if (!known.has(id)) {
      throw new PlanError(`Unknown step "${id}". Known steps: ${[...known].join(', ')}`);
    }
  }
  return STEPS.filter((step) => {
    if (fast && (step.needs.includes('docker') || step.needs.includes('browser'))) return false;
    if (only && !only.includes(step.id)) return false;
    return !skip.includes(step.id);
  });
}

const CAPABILITY_HELP = {
  docker:
    'Docker is required (daemon not reachable) — start Docker, or use `pnpm verify --fast` / `--skip` for those steps.',
  flutter:
    'The Flutter SDK is required (`flutter` not found on PATH) — install it, or use `--skip mobile:format,mobile:analyze,mobile:test,mobile:codegen`.',
};

/** @returns {string[]} human-readable problems; empty when every selected step can run. */
export function preflight(plan, capabilities) {
  const problems = [];
  for (const capability of ['docker', 'flutter']) {
    const needed = plan.filter((step) => step.needs.includes(capability));
    if (needed.length > 0 && !capabilities[capability]) {
      problems.push(
        `${CAPABILITY_HELP[capability]} (needed by: ${needed.map((s) => s.id).join(', ')})`,
      );
    }
  }
  return problems;
}

/**
 * @param {Step[]} plan
 * @param {(step: Step) => Promise<{ code: number }>} execute
 * @param {{ keepGoing?: boolean }} [options]
 * @returns {Promise<Array<{ id: string, label: string, status: 'pass'|'fail'|'skipped', ms: number }>>}
 */
export async function runPlan(plan, execute, { keepGoing = false } = {}) {
  const results = [];
  let failed = false;
  for (const step of plan) {
    if (failed && !keepGoing) {
      results.push({ id: step.id, label: step.label, status: 'skipped', ms: 0 });
      continue;
    }
    const started = Date.now();
    let code;
    try {
      ({ code } = await execute(step));
    } catch {
      code = 1; // an executor that throws counts as a failed step, never a crash
    }
    const status = code === 0 ? 'pass' : 'fail';
    if (status === 'fail') failed = true;
    results.push({ id: step.id, label: step.label, status, ms: Date.now() - started });
  }
  return results;
}

export const exitCodeFor = (results) => (results.every((r) => r.status === 'pass') ? 0 : 1);

export function formatSummary(results) {
  const width = Math.max(...results.map((r) => r.id.length), 4);
  const lines = results.map((r) => {
    const seconds = r.status === 'skipped' ? '    -' : `${(r.ms / 1000).toFixed(1)}s`.padStart(6);
    const mark = { pass: 'pass', fail: 'FAIL', skipped: 'skip' }[r.status];
    return `  ${r.id.padEnd(width)}  ${mark.padEnd(4)}  ${seconds}  ${r.label}`;
  });
  const count = (status) => results.filter((r) => r.status === status).length;
  const total = results.reduce((sum, r) => sum + r.ms, 0);
  const verdict = results.every((r) => r.status === 'pass') ? 'VERIFY PASSED' : 'VERIFY FAILED';
  return [
    '',
    '── verify summary ─────────────────────────────────────',
    ...lines,
    '───────────────────────────────────────────────────────',
    `  ${count('pass')} passed, ${count('fail')} failed, ${count('skipped')} skipped in ${(total / 1000).toFixed(1)}s`,
    `  ${verdict}`,
    '',
  ].join('\n');
}

/**
 * Same results as `runPlan`, in less time: every lane runs on its own (steps inside a lane stay in order), and the
 * `quiet` lane runs alone once the others are done. A failed lane stops only itself; without `keepGoing` the quiet
 * lane is skipped when anything failed. Results come back in plan order.
 * @param {Step[]} plan
 * @param {(step: Step) => Promise<{ code: number }>} execute
 * @param {{ keepGoing?: boolean, jobs?: number }} [options] `jobs`: how many lanes may run at the same time. All lanes at
 *   once overloads a laptop (the database container timed out), so callers choose; the longest lanes start first.
 */
export async function runParallel(plan, execute, { keepGoing = false, jobs = Infinity } = {}) {
  const lanes = new Map();
  for (const step of plan) {
    const lane = step.lane ?? step.id;
    if (!lanes.has(lane)) lanes.set(lane, []);
    lanes.get(lane).push(step);
  }
  const quiet = lanes.get('quiet') ?? [];
  lanes.delete('quiet');

  const byId = new Map();
  const collect = (results) => results.forEach((r) => byId.set(r.id, r));
  const queue = [...lanes.entries()]
    .sort((a, b) => LANE_ORDER.indexOf(a[0]) - LANE_ORDER.indexOf(b[0]))
    .map(([, steps]) => steps);
  const worker = async () => {
    for (let steps = queue.shift(); steps; steps = queue.shift()) {
      collect(await runPlan(steps, execute, { keepGoing }));
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(jobs, queue.length)) }, worker));
  const anyFailed = [...byId.values()].some((r) => r.status === 'fail');
  if (anyFailed && !keepGoing) {
    for (const step of quiet) {
      byId.set(step.id, { id: step.id, label: step.label, status: 'skipped', ms: 0 });
    }
  } else {
    collect(await runPlan(quiet, execute, { keepGoing }));
  }
  return plan.map((step) => byId.get(step.id));
}

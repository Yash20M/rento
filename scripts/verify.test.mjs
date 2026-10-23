import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PlanError,
  STEPS,
  buildPlan,
  exitCodeFor,
  formatSummary,
  preflight,
  runParallel,
  runPlan,
} from './verify-steps.mjs';

const ids = (plan) => plan.map((step) => step.id);
const allPass = async () => ({ code: 0 });

describe('buildPlan', () => {
  it('V-01 default plan: 16 steps, lint first, docker steps after static ones, e2e last', () => {
    const plan = buildPlan({});
    assert.equal(plan.length, 16);
    assert.equal(plan[0].id, 'lint');
    assert.equal(plan.at(-1).id, 'admin:e2e');
    const firstDocker = plan.findIndex((step) => step.needs.includes('docker'));
    assert.ok(plan.slice(0, firstDocker).every((step) => !step.needs.includes('docker')));
    assert.deepEqual(
      ids(plan),
      STEPS.map((step) => step.id),
    );
  });

  it('V-02 --fast drops every step that needs Docker or a browser', () => {
    const plan = buildPlan({ fast: true });
    assert.ok(plan.length > 0 && plan.length < 16);
    assert.ok(
      plan.every((step) => !step.needs.includes('docker') && !step.needs.includes('browser')),
    );
    assert.ok(ids(plan).includes('api:unit'));
    assert.ok(!ids(plan).includes('api:db'));
  });

  it('V-03 --only keeps exactly those (in plan order); --skip removes exactly those', () => {
    assert.deepEqual(ids(buildPlan({ only: ['api:unit', 'lint'] })), ['lint', 'api:unit']);
    const skipped = buildPlan({ skip: ['api:db', 'admin:e2e'] });
    assert.equal(skipped.length, 14);
    assert.ok(!ids(skipped).includes('api:db'));
  });

  it('V-04 an unknown id is an error naming it', () => {
    assert.throws(
      () => buildPlan({ only: ['nope'] }),
      (e) => e instanceof PlanError && /nope/.test(e.message),
    );
    assert.throws(() => buildPlan({ skip: ['also-nope'] }), PlanError);
  });

  it('every step has a unique id, a command and a label', () => {
    assert.equal(new Set(STEPS.map((s) => s.id)).size, STEPS.length);
    for (const step of STEPS) {
      assert.ok(step.command.startsWith('pnpm '), step.id);
      assert.ok(step.label.length > 0);
    }
  });
});

describe('runPlan', () => {
  const plan = buildPlan({ only: ['lint', 'typecheck', 'api:unit'] });

  it('V-05 stops at the first failure and marks the rest skipped', async () => {
    const executed = [];
    const results = await runPlan(
      plan,
      async (step) => {
        executed.push(step.id);
        return { code: step.id === 'typecheck' ? 1 : 0 };
      },
      { keepGoing: false },
    );
    assert.deepEqual(executed, ['lint', 'typecheck']);
    assert.deepEqual(
      results.map((r) => r.status),
      ['pass', 'fail', 'skipped'],
    );
    assert.equal(exitCodeFor(results), 1);
  });

  it('V-06 --keep-going runs everything and still exits 1', async () => {
    const executed = [];
    const results = await runPlan(
      plan,
      async (step) => {
        executed.push(step.id);
        return { code: step.id === 'lint' ? 1 : 0 };
      },
      { keepGoing: true },
    );
    assert.deepEqual(executed, ['lint', 'typecheck', 'api:unit']);
    assert.deepEqual(
      results.map((r) => r.status),
      ['fail', 'pass', 'pass'],
    );
    assert.equal(exitCodeFor(results), 1);
  });

  it('V-07 all green: exit 0 and the summary lists every step with a duration', async () => {
    const results = await runPlan(plan, allPass, { keepGoing: false });
    assert.equal(exitCodeFor(results), 0);
    const summary = formatSummary(results);
    for (const id of ['lint', 'typecheck', 'api:unit']) assert.match(summary, new RegExp(id));
    assert.match(summary, /pass/);
    assert.match(summary, /\d+(\.\d+)?s/);
    assert.match(summary, /3 passed/);
  });

  it('a thrown executor error counts as a failure, not a crash', async () => {
    const results = await runPlan(
      plan,
      async () => {
        throw new Error('spawn failed');
      },
      { keepGoing: false },
    );
    assert.equal(results[0].status, 'fail');
    assert.equal(exitCodeFor(results), 1);
  });

  it('the summary of a failing run says which step failed', async () => {
    const results = await runPlan(plan, async (s) => ({ code: s.id === 'api:unit' ? 1 : 0 }), {});
    assert.match(formatSummary(results), /api:unit\s+FAIL/);
    assert.match(formatSummary(results), /1 failed/);
  });
});

describe('preflight', () => {
  it('V-08 reports a missing Docker daemon by name and points at --fast', () => {
    const plan = buildPlan({});
    const problems = preflight(plan, { docker: false, flutter: true });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /Docker/);
    assert.match(problems[0], /--fast/);
  });

  it('reports a missing Flutter SDK', () => {
    const problems = preflight(buildPlan({}), { docker: true, flutter: false });
    assert.match(problems.join('\n'), /Flutter/);
  });

  it('no problems when capabilities are present, or when the steps needing them are excluded', () => {
    assert.deepEqual(preflight(buildPlan({}), { docker: true, flutter: true }), []);
    assert.deepEqual(
      preflight(
        buildPlan({
          fast: true,
          skip: ['mobile:format', 'mobile:analyze', 'mobile:test', 'mobile:codegen'],
        }),
        { docker: false, flutter: false },
      ),
      [],
    );
  });
});

describe('runParallel', () => {
  const full = buildPlan({});
  const events = [];
  const tracked =
    (failing = []) =>
    async (step) => {
      events.push(`start:${step.id}`);
      await new Promise((resolve) => setTimeout(resolve, step.id === 'lint' ? 30 : 5));
      events.push(`end:${step.id}`);
      return { code: failing.includes(step.id) ? 1 : 0 };
    };

  it('V-09 every step has a lane, and the concurrency suite is alone in the quiet lane', () => {
    assert.ok(STEPS.every((s) => typeof s.lane === 'string'));
    assert.deepEqual(
      STEPS.filter((s) => s.lane === 'quiet').map((s) => s.id),
      ['api:concurrency'],
    );
  });

  it('V-10 lanes overlap, steps inside a lane keep their order, quiet runs last and alone', async () => {
    events.length = 0;
    const results = await runParallel(full, tracked());
    assert.equal(exitCodeFor(results), 0);
    assert.deepEqual(
      results.map((r) => r.id),
      full.map((s) => s.id),
    );
    // another lane starts before the first (slow) lint step has ended
    assert.ok(events.indexOf('start:api:unit') < events.indexOf('end:lint'));
    assert.ok(events.indexOf('end:api:unit') < events.indexOf('start:api:db'));
    const quiet = events.indexOf('start:api:concurrency');
    for (const step of full.filter((s) => s.lane !== 'quiet')) {
      assert.ok(events.indexOf(`end:${step.id}`) < quiet, step.id);
    }
    assert.equal(events.at(-2), 'start:api:concurrency');
  });

  it('V-11 a failing step stops only its lane; the quiet lane is skipped; exit code 1', async () => {
    events.length = 0;
    const results = await runParallel(full, tracked(['api:unit']));
    const status = Object.fromEntries(results.map((r) => [r.id, r.status]));
    assert.equal(status['api:unit'], 'fail');
    assert.equal(status['api:db'], 'skipped');
    assert.equal(status['lint'], 'pass');
    assert.equal(status['mobile:test'], 'pass');
    assert.equal(status['api:concurrency'], 'skipped');
    assert.equal(exitCodeFor(results), 1);
  });

  it('V-13 jobs limits how many lanes run at once (longest lanes first)', async () => {
    let running = 0;
    let peak = 0;
    const started = [];
    const counted = async (step) => {
      running += 1;
      peak = Math.max(peak, running);
      started.push(step.lane);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      return { code: 0 };
    };
    const results = await runParallel(full, counted, { jobs: 2 });
    assert.equal(exitCodeFor(results), 0);
    assert.ok(peak <= 2, `peak ${peak}`);
    assert.equal(started[0], 'api');
    assert.equal(started.at(-1), 'quiet'); // the concurrency suite still runs last
    assert.equal(results.length, full.length);
  });

  it('V-12 --keep-going still runs everything', async () => {
    events.length = 0;
    const results = await runParallel(full, tracked(['api:unit']), { keepGoing: true });
    assert.equal(results.find((r) => r.id === 'api:db').status, 'pass');
    assert.equal(results.find((r) => r.id === 'api:concurrency').status, 'pass');
  });
});

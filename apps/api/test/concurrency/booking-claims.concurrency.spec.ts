import { afterEach, describe, expect, it } from 'vitest';
import { createFactories } from '../factories';
import { type ClaimInput, claimSlot } from '../support/booking-spike';
import {
  ROUNDS,
  addMinutes,
  at,
  expectInvariants,
  expectNoUnexpectedErrors,
  insertUsers,
  seededRandom,
  startTogether,
  tally,
  warmedPool,
} from '../support/concurrency';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';

const PARALLEL = 50;

interface Scenario {
  drawerId: string;
  itemModelId: string;
  assetIds: string[];
  userIds: string[];
}

let database: TestDatabase | undefined;
const closers: Array<() => Promise<void>> = [];

async function seed(assets: number, users: number): Promise<Scenario> {
  database = await createTestDatabase();
  const f = createFactories(database.db);
  const drawer = await f.drawer();
  const model = await f.itemModel();
  const assetIds: string[] = [];
  for (let i = 1; i <= assets; i += 1) {
    const asset = await f.asset({
      drawer_id: drawer.id,
      item_model_id: model.id,
      asset_code: `PS5-${String(i).padStart(3, '0')}`,
    });
    assetIds.push(asset.id);
  }
  return {
    drawerId: drawer.id,
    itemModelId: model.id,
    assetIds,
    userIds: await insertUsers(database.db, users),
  };
}

afterEach(async () => {
  for (const close of closers.splice(0)) await close();
  await database?.drop();
  database = undefined;
});

const rounds = Array.from({ length: ROUNDS }, (_, index) => index + 1);
const policies = ['conflict', 'wait'] as const;

describe.each(policies)('concurrent booking claims — locked-asset policy "%s"', (policy) => {
  describe.each(rounds)('round %i', (round) => {
    const label = (id: string) => `${id} [${policy}, round ${round}/${ROUNDS}]`;
    let s: Scenario;

    async function pool(size: number) {
      if (!database) throw new Error('seed() first');
      const warmed = await warmedPool(database, size);
      closers.push(warmed.close);
      return warmed;
    }

    /** Builds a task that claims `[from, to)` for one user. */
    const claim =
      (db: Awaited<ReturnType<typeof pool>>['db'], userId: string) =>
      (from: Date, to: Date, bufferMin = 0, beforeCommit?: ClaimInput['beforeCommit']) =>
      () =>
        claimSlot(db, {
          userId,
          drawerId: s.drawerId,
          itemModelId: s.itemModelId,
          startsAt: from,
          endsAt: to,
          bufferMin,
          lockedPolicy: policy,
          ...(beforeCommit && { beforeCommit }),
        });

    it(label('C-01 50 overlapping claims, 1 asset → exactly 1 wins'), async () => {
      s = await seed(1, PARALLEL);
      const { db, pool: p } = await pool(PARALLEL);
      const start = at('04:30');

      const outcomes = await startTogether(
        s.userIds.map((userId, i) =>
          // staggered overlapping starts 04:30 / 04:45 / 05:00, all 60 minutes long
          claim(db, userId)(addMinutes(start, (i % 3) * 15), addMinutes(start, (i % 3) * 15 + 60)),
        ),
      );

      expectNoUnexpectedErrors(outcomes);
      expect(tally(outcomes)).toEqual({ ok: 1, conflict: 49, retry_later: 0, other: 0 });
      expect(p.totalCount).toBeGreaterThanOrEqual(40); // the database really saw wide parallelism
      await expectInvariants(p, 1);
    });

    it(
      label('C-02 50 identical claims, 3 assets → exactly 3 win, on 3 distinct assets'),
      async () => {
        s = await seed(3, PARALLEL);
        const { db, pool: p } = await pool(PARALLEL);

        const outcomes = await startTogether(
          s.userIds.map((userId) => claim(db, userId)(at('10:00'), at('11:00'))),
        );

        expectNoUnexpectedErrors(outcomes);
        expect(tally(outcomes)).toEqual({ ok: 3, conflict: 47, retry_later: 0, other: 0 });
        const winners = outcomes.flatMap((o) =>
          o.kind === 'ok' ? [(o.value as { assetId: string }).assetId] : [],
        );
        expect([...winners].sort()).toEqual([...s.assetIds].sort());
        await expectInvariants(p, 3);
      },
    );

    it(label('C-03 20 back-to-back hourly claims, 1 asset'), async () => {
      s = await seed(1, 20);
      const { db, pool: p } = await pool(20);
      const hour = (h: number) => at(`${String(h).padStart(2, '0')}:00`);

      const outcomes = await startTogether(
        s.userIds.map((userId, i) => claim(db, userId)(hour(i), hour(i + 1))),
      );

      expectNoUnexpectedErrors(outcomes);
      const counts = tally(outcomes);
      expect(counts.ok + counts.conflict).toBe(20);
      if (policy === 'wait') {
        // Decided on the truth: none of these windows overlap, so every claim must win.
        expect(counts).toEqual({ ok: 20, conflict: 0, retry_later: 0, other: 0 });
      } else {
        // README §9.4 as written: claims arriving while another holds the asset's row lock are skipped,
        // so non-overlapping requests can get a *false* (but safe) 409. We only require safety here;
        // the false-conflict cost is quantified by comparing with the "wait" policy.
        expect(counts.ok).toBeGreaterThanOrEqual(1);
      }
      await expectInvariants(p, counts.ok);
    });

    it(label('C-04 buffer 15 min: adjacency allowed, buffer overlap rejected'), async () => {
      s = await seed(1, 30);
      const { db, pool: p } = await pool(30);
      const users = s.userIds;

      // Phase 1, parallel: A=[10:00,11:00)+15 occupies to 11:15; D=[11:15,12:15) is adjacent, not overlapping.
      const phase1 = await startTogether([
        ...users.slice(0, 10).map((u) => claim(db, u)(at('10:00'), at('11:00'), 15)),
        ...users.slice(10, 20).map((u) => claim(db, u)(at('11:15'), at('12:15'), 15)),
      ]);
      expectNoUnexpectedErrors(phase1);
      const winsA = phase1.slice(0, 10).filter((o) => o.kind === 'ok').length;
      const winsD = phase1.slice(10).filter((o) => o.kind === 'ok').length;
      expect(winsA).toBeLessThanOrEqual(1);
      expect(winsD).toBeLessThanOrEqual(1);
      if (policy === 'wait') expect([winsA, winsD]).toEqual([1, 1]);

      // Phase 2, after phase 1 committed: E=[11:00,12:00) overlaps A's buffer and D → nobody wins.
      const phase2 = await startTogether(
        users.slice(20, 30).map((u) => claim(db, u)(at('11:00'), at('12:00'), 15)),
      );
      expectNoUnexpectedErrors(phase2);
      expect(tally(phase2)).toEqual({ ok: 0, conflict: 10, retry_later: 0, other: 0 });

      await expectInvariants(p, winsA + winsD);
    });

    it(label('C-04b buffer 15 min, sequential: 10:00 then 11:15 win, 11:00 loses'), async () => {
      s = await seed(1, 3);
      const { db, pool: p } = await pool(3);
      const [u1, u2, u3] = s.userIds as [string, string, string];

      await claim(db, u1)(at('10:00'), at('11:00'), 15)();
      await claim(db, u2)(at('11:15'), at('12:15'), 15)();
      const outcomes = await startTogether([claim(db, u3)(at('11:00'), at('12:00'), 15)]);

      expect(tally(outcomes)).toEqual({ ok: 0, conflict: 1, retry_later: 0, other: 0 });
      await expectInvariants(p, 2);
    });

    it(label('C-05 randomised mixed workload, 3 assets → all invariants hold'), async () => {
      s = await seed(3, PARALLEL);
      const { db, pool: p } = await pool(PARALLEL);
      const random = seededRandom(20301 + round);
      const dayStart = at('08:00');

      const outcomes = await startTogether(
        s.userIds.map((userId) => {
          const startOffset = Math.floor(random() * 32) * 15; // quarter-hours across 8 hours
          const duration = 30 + Math.floor(random() * 7) * 15; // 30..120 minutes
          const from = addMinutes(dayStart, startOffset);
          return claim(db, userId)(from, addMinutes(from, duration));
        }),
      );

      expectNoUnexpectedErrors(outcomes);
      const counts = tally(outcomes);
      expect(counts.ok + counts.conflict).toBe(PARALLEL);
      expect(counts.ok).toBeGreaterThanOrEqual(3);
      await expectInvariants(p, counts.ok);
    });

    it(label('C-06 50 overlapping claims through the app-default pool (10)'), async () => {
      s = await seed(1, PARALLEL);
      const { db, pool: p } = await pool(10);

      const outcomes = await startTogether(
        s.userIds.map((userId) => claim(db, userId)(at('10:00'), at('11:00'))),
      );

      expectNoUnexpectedErrors(outcomes);
      expect(tally(outcomes)).toEqual({ ok: 1, conflict: 49, retry_later: 0, other: 0 });
      expect(p.totalCount).toBeLessThanOrEqual(10);
      await expectInvariants(p, 1);
    });

    it(label('C-07 a claim in flight, then rolled back, leaves no ghost'), async () => {
      s = await seed(1, 12);
      const { db, pool: p } = await pool(12);
      const [holder, ...others] = s.userIds as [string, ...string[]];

      let inserted!: () => void;
      const holderInserted = new Promise<void>((resolve) => {
        inserted = resolve;
      });
      let rollBack!: () => void;
      const mayRollBack = new Promise<void>((resolve) => {
        rollBack = resolve;
      });

      // The holder inserts booking + occupancy, then stalls inside its transaction and finally fails.
      const holderRun = claim(db, holder)(at('10:00'), at('11:00'), 0, async () => {
        inserted();
        await mayRollBack;
        throw new Error('payment init failed');
      })().then(
        () => 'committed',
        (error: unknown) => (error instanceof Error ? error.message : 'unknown'),
      );
      await holderInserted;

      // Ten more claims for the same slot arrive while the holder is still in flight.
      const waiting = startTogether(
        others.slice(0, 10).map((u) => claim(db, u)(at('10:00'), at('11:00'))),
      );

      if (policy === 'conflict') {
        // SKIP LOCKED: the held asset is invisible to them → immediate clean 409s, no queueing.
        const during = await waiting;
        expectNoUnexpectedErrors(during);
        expect(tally(during)).toEqual({ ok: 0, conflict: 10, retry_later: 0, other: 0 });
        rollBack();
        expect(await holderRun).toBe('payment init failed');
        const after = await startTogether([
          claim(db, others[10] as string)(at('10:00'), at('11:00')),
        ]);
        expect(tally(after)).toEqual({ ok: 1, conflict: 0, retry_later: 0, other: 0 });
        await expectInvariants(p, 1);
      } else {
        // wait: they queue behind the holder; when it rolls back exactly one of them wins the slot.
        rollBack();
        expect(await holderRun).toBe('payment init failed');
        const outcomes = await waiting;
        expectNoUnexpectedErrors(outcomes);
        expect(tally(outcomes)).toEqual({ ok: 1, conflict: 9, retry_later: 0, other: 0 });
        await expectInvariants(p, 1);
      }
    });
  });
});

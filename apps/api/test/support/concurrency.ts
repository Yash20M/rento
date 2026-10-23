import { randomBytes } from 'node:crypto';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import { Pool } from 'pg';
import { expect } from 'vitest';
import { RetryLaterError, SlotTakenError } from '../../src/db/errors';
import { type Database, createDb } from '../../src/db/kysely';
import { type TestDatabase } from './db/test-database';

export type Outcome =
  | { kind: 'ok'; value: unknown }
  | { kind: 'conflict' }
  | { kind: 'retry_later' }
  | { kind: 'other'; error: unknown };

export const ROUNDS = Number.parseInt(process.env['CONCURRENCY_ROUNDS'] ?? '5', 10);

/** A pool with `size` connections that are already open, so all tasks hit the server at once. */
export async function warmedPool(
  database: TestDatabase,
  size: number,
): Promise<{
  pool: Pool;
  db: Kysely<Database>;
  close: () => Promise<void>;
}> {
  const pool = new Pool({ connectionString: database.url, max: size });
  pool.on('error', () => undefined);
  const clients = await Promise.all(Array.from({ length: size }, () => pool.connect()));
  clients.forEach((client) => client.release());
  const db = createDb(pool);
  return { pool, db, close: () => db.destroy() };
}

/**
 * Starts every task at the same instant (barrier) and classifies each result. No sleeping: ordering
 * comes from the barrier and from the database itself.
 */
export async function startTogether<T>(tasks: Array<() => Promise<T>>): Promise<Outcome[]> {
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });

  const running = tasks.map(async (task): Promise<Outcome> => {
    await barrier;
    try {
      return { kind: 'ok', value: await task() };
    } catch (error) {
      if (error instanceof SlotTakenError) return { kind: 'conflict' };
      if (error instanceof RetryLaterError) return { kind: 'retry_later' };
      return { kind: 'other', error };
    }
  });

  release();
  return Promise.all(running);
}

export function tally(outcomes: Outcome[]): Record<Outcome['kind'], number> {
  const counts = { ok: 0, conflict: 0, retry_later: 0, other: 0 };
  for (const outcome of outcomes) counts[outcome.kind] += 1;
  return counts;
}

/** Fails the test (showing the raw errors) if anything other than ok/conflict happened. */
export function expectNoUnexpectedErrors(outcomes: Outcome[]): void {
  const bad = outcomes.filter((o) => o.kind === 'other' || o.kind === 'retry_later');
  expect(
    bad.map((o) => (o.kind === 'other' ? String(o.error) : o.kind)),
    'deadlocks, lock timeouts or unmapped errors must never occur',
  ).toEqual([]);
}

/** README §16: pairs of live occupancies of one asset whose ranges overlap. Must always be empty. */
export async function findOverlaps(pool: Pool): Promise<unknown[]> {
  const result = await pool.query(`
    SELECT a.id AS a_id, b.id AS b_id
      FROM asset_occupancies a JOIN asset_occupancies b
        ON a.asset_id = b.asset_id AND a.id < b.id AND a.during && b.during
     WHERE a.released_at IS NULL AND b.released_at IS NULL`);
  return result.rows;
}

/** Database-level invariants, checked directly in SQL and independent of the code under test. */
export async function expectInvariants(pool: Pool, okCount: number): Promise<void> {
  expect(await findOverlaps(pool), 'no two live occupancies may overlap').toEqual([]);

  const counts = await pool.query<{ live: number; bookings: number }>(`
    SELECT (SELECT count(*)::int FROM asset_occupancies WHERE released_at IS NULL) AS live,
           (SELECT count(*)::int FROM bookings) AS bookings`);
  expect(counts.rows[0]?.live, 'live occupancies == successful claims').toBe(okCount);
  expect(counts.rows[0]?.bookings, 'losers must leave no booking rows behind').toBe(okCount);

  const mismatched = await pool.query(`
    SELECT o.id FROM asset_occupancies o
      LEFT JOIN bookings b ON b.id = o.booking_id AND b.asset_id = o.asset_id
     WHERE o.released_at IS NULL AND b.id IS NULL`);
  expect(mismatched.rowCount, 'every live occupancy points at a booking on the same asset').toBe(0);

  const duplicated = await pool.query(`
    SELECT booking_id FROM asset_occupancies
     WHERE released_at IS NULL GROUP BY booking_id HAVING count(*) > 1`);
  expect(duplicated.rowCount, 'a booking has at most one live occupancy').toBe(0);
}

/** Small deterministic PRNG (mulberry32) so randomised workloads are reproducible. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function insertUsers(db: Kysely<Database>, count: number): Promise<string[]> {
  const tag = randomBytes(4).toString('hex');
  const rows = await sql<{ id: string }>`
    INSERT INTO users (email)
    SELECT ${tag} || '-' || g || '@example.com' FROM generate_series(1, ${count}::int) g
    RETURNING id`.execute(db);
  return rows.rows.map((row) => row.id);
}

export const at = (hhmm: string, day = '2030-01-01'): Date => new Date(`${day}T${hhmm}:00Z`);
export const addMinutes = (date: Date, minutes: number): Date =>
  new Date(date.getTime() + minutes * 60_000);

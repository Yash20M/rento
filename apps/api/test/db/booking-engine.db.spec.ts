import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Factories, createFactories } from '../factories';
import { expectPgError } from '../support/db/pg-assert';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';

const CHECK_VIOLATION = '23514';
const UNIQUE_VIOLATION = '23505';
const INTEGRITY = '23000';

let db: TestDatabase;
let f: Factories;
beforeAll(async () => {
  db = await createTestDatabase();
  f = createFactories(db.db);
});
afterAll(async () => {
  await db.drop();
});

const payment = (bookingId: string, order: string, status = 'created') =>
  db.pool.query(
    `INSERT INTO payments (booking_id, provider, provider_order_id, amount_paise, status)
     VALUES ($1, 'fake', $2, 1000, $3)`,
    [bookingId, order, status],
  );

describe('idempotency_keys', () => {
  it('E-1 one row per (user, key); another user may reuse the key', async () => {
    const a = await f.user();
    const b = await f.user();
    const insert = (user: string) =>
      db.pool.query(
        `INSERT INTO idempotency_keys (user_id, key, request_hash) VALUES ($1, 'key-12345678', 'h')`,
        [user],
      );
    await insert(a.id);
    await expectPgError(insert(a.id), {
      code: UNIQUE_VIOLATION,
      constraint: 'idempotency_keys_pkey',
    });
    await insert(b.id);
  });

  it('E-2 a stored response needs both its status and its completion time (and vice versa); keys are 8–128 long', async () => {
    const u = await f.user();
    await expectPgError(
      db.pool.query(
        `INSERT INTO idempotency_keys (user_id, key, request_hash, response_status) VALUES ($1, 'key-87654321', 'h', 201)`,
        [u.id],
      ),
      { code: CHECK_VIOLATION, constraint: 'idempotency_keys_complete_together' },
    );
    await expectPgError(
      db.pool.query(
        `INSERT INTO idempotency_keys (user_id, key, request_hash) VALUES ($1, 'short', 'h')`,
        [u.id],
      ),
      { code: CHECK_VIOLATION, constraint: 'idempotency_keys_key_length' },
    );
  });
});

describe('booking_events', () => {
  it('E-3 history can neither be changed, removed nor truncated — by any role', async () => {
    const booking = await f.booking();
    await db.pool.query(
      `INSERT INTO booking_events (booking_id, from_status, to_status) VALUES ($1, NULL, 'held')`,
      [booking.id],
    );
    await expectPgError(db.pool.query(`UPDATE booking_events SET note = 'x'`), { code: INTEGRITY });
    await expectPgError(db.pool.query(`DELETE FROM booking_events`), { code: INTEGRITY });
    await expectPgError(db.pool.query(`TRUNCATE booking_events`), { code: INTEGRITY });
  });

  it('E-4 only real statuses are accepted', async () => {
    const booking = await f.booking();
    await expectPgError(
      db.pool.query(
        `INSERT INTO booking_events (booking_id, to_status) VALUES ($1, 'teleported')`,
        [booking.id],
      ),
      { code: CHECK_VIOLATION, constraint: 'booking_events_to_status' },
    );
  });
});

describe('outbox_events', () => {
  it('E-5 event types look like entity.verb, and new events are pending', async () => {
    await expectPgError(
      db.pool.query(`INSERT INTO outbox_events (type, payload) VALUES ('Booking Held', '{}')`),
      { code: CHECK_VIOLATION, constraint: 'outbox_events_type_format' },
    );
    const row = await db.pool.query(
      `INSERT INTO outbox_events (type, payload) VALUES ('booking.held', '{}') RETURNING processed_at, attempts`,
    );
    expect(row.rows[0]).toEqual({ processed_at: null, attempts: 0 });
  });
});

describe('payments and refunds', () => {
  it('E-6 a booking has at most one open payment; a failed one makes room for the next', async () => {
    const booking = await f.booking();
    await payment(booking.id, 'order-a');
    await expectPgError(payment(booking.id, 'order-b'), {
      code: UNIQUE_VIOLATION,
      constraint: 'payments_one_open_per_booking',
    });
    await db.pool.query(`UPDATE payments SET status = 'failed' WHERE booking_id = $1`, [
      booking.id,
    ]);
    await payment(booking.id, 'order-b');
  });

  it('E-7 a gateway order id is unique per provider; amounts are non-negative integers; only INR', async () => {
    const one = await f.booking();
    const two = await f.booking();
    await payment(one.id, 'order-shared');
    await expectPgError(payment(two.id, 'order-shared'), {
      code: UNIQUE_VIOLATION,
      constraint: 'payments_order_unique',
    });
    await expectPgError(
      db.pool.query(
        `INSERT INTO payments (booking_id, provider, provider_order_id, amount_paise) VALUES ($1, 'fake', 'neg', -1)`,
        [two.id],
      ),
      { code: CHECK_VIOLATION },
    );
    await expectPgError(
      db.pool.query(
        `INSERT INTO payments (booking_id, provider, provider_order_id, amount_paise, currency) VALUES ($1, 'fake', 'usd', 5, 'USD')`,
        [two.id],
      ),
      { code: CHECK_VIOLATION },
    );
  });

  it('E-8 one refund per booking: cancelling twice can never refund twice', async () => {
    const booking = await f.booking();
    await payment(booking.id, 'order-refund', 'captured');
    const paid = await db.pool.query<{ id: string }>(
      `SELECT id FROM payments WHERE booking_id = $1`,
      [booking.id],
    );
    const refund = () =>
      db.pool.query(
        `INSERT INTO refunds (booking_id, payment_id, amount_paise) VALUES ($1, $2, 500)`,
        [booking.id, paid.rows[0]!.id],
      );
    await refund();
    await expectPgError(refund(), {
      code: UNIQUE_VIOLATION,
      constraint: 'refunds_one_per_booking',
    });
    await expectPgError(
      db.pool.query(`UPDATE refunds SET status = 'maybe' WHERE booking_id = $1`, [booking.id]),
      { code: CHECK_VIOLATION },
    );
  });
});

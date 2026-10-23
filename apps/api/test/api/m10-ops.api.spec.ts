import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createFactories, type Factories } from '../factories';
import { grantPermissions, makeSuperAdmin } from '../support/access';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeClock } from '../support/fake-clock';
import { type TestSession, freshSession, registerSession } from '../support/sessions';

const START = '2030-01-07T03:00:00Z'; // Monday 08:30 IST
const T10 = '2030-01-09T04:30:00Z'; // Wednesday 10:00 IST (two days ahead)
const T12 = '2030-01-09T06:30:00Z'; // 12:00 IST
const T14 = '2030-01-09T08:30:00Z'; // 14:00 IST
const T16 = '2030-01-09T10:30:00Z'; // 16:00 IST
const MIN = 60_000;

interface Problem {
  code: string;
  errors?: Array<{ field: string; message: string }>;
}
interface Booking {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  pricePaise: number;
  asset: { id: string; code: string };
}
interface Checkout {
  orderId: string;
  paymentId: string;
  signature: string;
}
interface World {
  drawerId: string;
  modelId: string;
  assetIds: string[];
  codes: string[];
}
interface Block {
  id: string;
  assetId: string;
  kind: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
}
interface Impact {
  bookings: Array<{ bookingId: string; status: string; customer: string | null }>;
  blocks: Block[];
  clear: boolean;
}
interface Schedule {
  drawerName: string;
  timezone: string;
  assets: Array<{
    assetId: string;
    assetCode: string;
    entries: Array<{
      kind: string;
      blockedFrom: string;
      blockedUntil: string;
      bookingId?: string;
      bookingStatus?: string;
      customer?: string;
      blockId?: string;
      reason?: string;
    }>;
  }>;
}

let database: TestDatabase;
let app: TestApp;
let clock: FakeClock;
let f: Factories;
let counter = 0;
let boss: TestSession;
let alice: TestSession;
let bob: TestSession;

beforeAll(async () => {
  database = await createTestDatabase();
  f = createFactories(database.db);
  clock = new FakeClock(START);
  app = await createTestApp({ config: testConfig({ DATABASE_URL: database.url }), clock });
  boss = await registerSession(app, clock, 'x');
  alice = await registerSession(app, clock, 'x');
  bob = await registerSession(app, clock, 'x');
  await makeSuperAdmin(database.pool, boss.user.id);
});
afterAll(async () => {
  await app.app.close();
  await database.drop();
});

const call = async (
  who: TestSession | undefined,
  method: 'GET' | 'POST' | 'DELETE',
  url: string,
  payload?: Record<string, unknown>,
  headers: Record<string, string> = {},
) =>
  app.app.inject({
    method,
    url,
    headers: {
      ...(who && { authorization: `Bearer ${(await freshSession(app, clock, who)).accessToken}` }),
      ...headers,
    },
    ...(payload !== undefined && { payload }),
  });

async function world(units = 2, o: { max?: number } = {}): Promise<World> {
  const drawer = await f.drawer();
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    await database.pool.query(
      `INSERT INTO drawer_hours (drawer_id, weekday, opens_at, closes_at) VALUES ($1, $2, '08:00', '22:00')`,
      [drawer.id, weekday],
    );
  }
  const model = await f.itemModel({
    slot_minutes: 30,
    min_duration_min: 30,
    max_duration_min: o.max ?? 240,
    price_per_slot_paise: 4900,
    buffer_min: 15,
    deposit_paise: 20000,
  });
  const assetIds: string[] = [];
  const codes: string[] = [];
  for (let i = 0; i < units; i += 1) {
    const code = `Q-${(counter += 1)}`;
    const asset = await f.asset({
      drawer_id: drawer.id,
      item_model_id: model.id,
      asset_code: code,
    });
    assetIds.push(asset.id);
    codes.push(code);
  }
  return { drawerId: drawer.id, modelId: model.id, assetIds, codes };
}
const book = (who: TestSession, w: World, startsAt: string, minutes: number) =>
  call(
    who,
    'POST',
    '/v1/bookings',
    { drawerId: w.drawerId, itemModelId: w.modelId, startsAt, durationMinutes: minutes },
    { 'idempotency-key': `k-${(counter += 1)}-${Date.now()}` },
  );
async function confirmed(who: TestSession, w: World, startsAt = T10, minutes = 60) {
  const held = (await book(who, w, startsAt, minutes)).json<Booking>();
  await call(who, 'POST', `/v1/bookings/${held.id}/payment`);
  const checkout = (
    await call(who, 'POST', `/v1/bookings/${held.id}/payment/simulate`)
  ).json<Checkout>();
  const res = await call(who, 'POST', `/v1/bookings/${held.id}/payment/confirm`, checkout as never);
  expect(res.statusCode, res.body).toBe(200);
  const asset = (
    await database.pool.query(
      'SELECT a.id, a.asset_code FROM bookings b JOIN assets a ON a.id = b.asset_id WHERE b.id = $1',
      [held.id],
    )
  ).rows[0];
  return {
    ...res.json<Booking>(),
    asset: { id: asset.id as string, code: asset.asset_code as string },
  };
}
const reassign = (id: string, body: Record<string, unknown>, who: TestSession | null = boss) =>
  call(who ?? undefined, 'POST', `/v1/admin/bookings/${id}/reassign`, body);
const block = (
  assetId: string,
  startsAt: string,
  endsAt: string,
  extra: Record<string, unknown> = {},
  who: TestSession | null = boss,
) =>
  call(who ?? undefined, 'POST', `/v1/admin/assets/${assetId}/blocks`, {
    startsAt,
    endsAt,
    reason: 'Brake check',
    ...extra,
  } as never);
const live = async (bookingId: string) =>
  (
    await database.pool.query(
      `SELECT asset_id, lower(during) AS lo, upper(during) AS hi FROM asset_occupancies
        WHERE booking_id = $1 AND released_at IS NULL`,
      [bookingId],
    )
  ).rows as Array<{ asset_id: string; lo: Date; hi: Date }>;
const assetOf = async (bookingId: string) =>
  (await database.pool.query('SELECT asset_id FROM bookings WHERE id = $1', [bookingId])).rows[0]
    .asset_id as string;
const auditRows = async (action: string, entityId: string) =>
  (
    await database.pool.query(
      'SELECT actor_id, reason, before, after FROM audit_logs WHERE action = $1 AND entity_id = $2',
      [action, entityId],
    )
  ).rows;

// ── reassign ───────────────────────────────────────────────────────────────────────────────────────
describe('reassign a booking to another unit', () => {
  it('R-1 moves to the chosen free unit in one step: time and price unchanged, audited with the reason', async () => {
    const w = await world();
    const b = await confirmed(alice, w);
    const from = await assetOf(b.id);
    const target = w.assetIds.find((id) => id !== from)!;
    const before = await live(b.id);

    const res = await reassign(b.id, { assetId: target, reason: 'Left tyre is worn' });
    expect(res.statusCode, res.body).toBe(200);
    const moved = res.json<Booking>();
    expect(moved.startsAt).toBe(b.startsAt);
    expect(moved.endsAt).toBe(b.endsAt);
    expect(moved.pricePaise).toBe(b.pricePaise);
    expect(moved.status).toBe('confirmed');

    const after = await live(b.id);
    expect(after).toHaveLength(1);
    expect(after[0]!.asset_id).toBe(target);
    expect(after[0]!.lo).toEqual(before[0]!.lo);
    expect(after[0]!.hi).toEqual(before[0]!.hi);
    expect(await assetOf(b.id)).toBe(target);

    const [audit] = await auditRows('booking.reassigned', b.id);
    expect(audit.actor_id).toBe(boss.user.id);
    expect(audit.reason).toBe('Left tyre is worn');
    const history = await database.pool.query(
      `SELECT note FROM booking_events WHERE booking_id = $1 AND note LIKE 'Moved from unit%'`,
      [b.id],
    );
    expect(history.rows).toHaveLength(1);
  });

  it('R-2 without a unit it picks a free one of the same model', async () => {
    const w = await world(3);
    const b = await confirmed(alice, w);
    const res = await reassign(b.id, { reason: 'Rebalancing the fleet' });
    expect(res.statusCode, res.body).toBe(200);
    expect(await assetOf(b.id)).not.toBe(b.asset.id);
    expect(w.assetIds).toContain(await assetOf(b.id));
  });

  it('R-3 a unit that is taken at that time is refused and the booking is exactly as it was', async () => {
    const w = await world(2);
    const first = await confirmed(alice, w);
    const second = await confirmed(bob, w); // takes the other unit at the same time
    const target = await assetOf(second.id);
    const before = await live(first.id);

    const res = await reassign(first.id, { assetId: target, reason: 'Swap please' });
    expect(res.statusCode).toBe(409);
    expect(res.json<Problem>().code).toBe('BOOKING_SLOT_TAKEN');
    expect(await assetOf(first.id)).toBe(first.asset.id);
    expect(await live(first.id)).toEqual(before);
    expect(await auditRows('booking.reassigned', first.id)).toHaveLength(0);
  });

  it('R-4 with no free unit at all, the automatic choice is refused', async () => {
    const w = await world(1);
    const b = await confirmed(alice, w);
    const res = await reassign(b.id, { reason: 'No other unit exists' });
    expect(res.statusCode).toBe(409);
    expect(res.json<Problem>().code).toBe('BOOKING_SLOT_TAKEN');
    expect(await assetOf(b.id)).toBe(b.asset.id);
  });

  it('R-5 validation and state rules', async () => {
    const w = await world(2);
    const other = await world(1);
    const b = await confirmed(alice, w);
    expect((await reassign(b.id, {})).statusCode).toBe(422);
    expect((await reassign(b.id, { reason: 'x' })).statusCode).toBe(422);
    expect((await reassign(b.id, { reason: 'Same unit', assetId: b.asset.id })).statusCode).toBe(
      422,
    );
    const wrongModel = await reassign(b.id, { reason: 'Other drawer', assetId: other.assetIds[0] });
    expect(wrongModel.statusCode).toBe(422);
    expect(wrongModel.json<Problem>().errors?.[0]?.field).toBe('assetId');
    expect((await reassign(b.id, { reason: 'Not a unit', assetId: 'not-a-uuid' })).statusCode).toBe(
      422,
    );

    // A unit that is in the workshop is not a valid target.
    const spare = w.assetIds.find((id) => id !== b.asset.id)!;
    await database.pool.query(`UPDATE assets SET status = 'maintenance' WHERE id = $1`, [spare]);
    expect((await reassign(b.id, { reason: 'Into workshop', assetId: spare })).statusCode).toBe(
      409,
    );
    await database.pool.query(`UPDATE assets SET status = 'available' WHERE id = $1`, [spare]);

    // Nothing to move once the booking is over.
    await call(alice, 'POST', `/v1/bookings/${b.id}/cancel`);
    const late = await reassign(b.id, { reason: 'Too late to move' });
    expect(late.statusCode).toBe(409);
    expect(late.json<Problem>().code).toBe('INVALID_STATE');
    expect(
      (await reassign('00000000-0000-4000-8000-000000000000', { reason: 'Nobody' })).statusCode,
    ).toBe(404);
  });

  it('R-6 the options are the free units of the same model, never the current or a busy one', async () => {
    const w = await world(3);
    const b = await confirmed(alice, w);
    const busy = await confirmed(bob, w);
    const options = (await call(boss, 'GET', `/v1/admin/bookings/${b.id}/reassign-options`)).json<
      Array<{ assetId: string; assetCode: string }>
    >();
    const free = w.assetIds.filter((id) => id !== b.asset.id && id !== busy.asset.id);
    expect(options.map((o) => o.assetId)).toEqual(free);

    await call(alice, 'POST', `/v1/bookings/${b.id}/cancel`);
    expect((await call(boss, 'GET', `/v1/admin/bookings/${b.id}/reassign-options`)).json()).toEqual(
      [],
    );
  });

  it('R-7 permissions and drawer scope', async () => {
    const w = await world(2);
    const elsewhere = await world(2);
    const b = await confirmed(alice, w);
    const reader = await registerSession(app, clock, 'x');
    await grantPermissions(database.pool, reader.user.id, ['bookings:read']);
    const scoped = await registerSession(app, clock, 'x');
    await grantPermissions(
      database.pool,
      scoped.user.id,
      ['bookings:read', 'bookings:write'],
      elsewhere.drawerId,
    );
    const own = await registerSession(app, clock, 'x');
    await grantPermissions(
      database.pool,
      own.user.id,
      ['bookings:read', 'bookings:write'],
      w.drawerId,
    );

    const body = { reason: 'Permission check' };
    expect((await reassign(b.id, body, null)).statusCode).toBe(401);
    expect((await reassign(b.id, body, alice)).statusCode).toBe(403);
    expect((await reassign(b.id, body, reader)).statusCode).toBe(403);
    expect((await reassign(b.id, body, scoped)).statusCode).toBe(404);
    expect(
      (await call(scoped, 'GET', `/v1/admin/bookings/${b.id}/reassign-options`)).statusCode,
    ).toBe(404);
    expect(await assetOf(b.id)).toBe(b.asset.id);
    expect((await reassign(b.id, body, own)).statusCode).toBe(200);
  });
});

// ── blocks ─────────────────────────────────────────────────────────────────────────────────────────
describe('maintenance blocks', () => {
  it('B-1 a block makes the unit unbookable for that time only, and is listed and audited', async () => {
    const w = await world(1);
    const res = await block(w.assetIds[0]!, T10, T12, { reason: 'Chain replacement' });
    expect(res.statusCode, res.body).toBe(201);
    const created = res.json<Block>();
    expect(created).toMatchObject({
      assetId: w.assetIds[0],
      kind: 'maintenance',
      reason: 'Chain replacement',
    });

    expect((await book(alice, w, T10, 60)).statusCode).toBe(409); // during the block
    expect((await book(alice, w, T12, 60)).statusCode).toBe(201); // right after: half-open, no gap needed

    const list = await call(boss, 'GET', `/v1/admin/assets/${w.assetIds[0]}/blocks`);
    expect(list.json<Block[]>().map((b) => b.id)).toEqual([created.id]);
    const [audit] = await auditRows('asset.blocked', w.assetIds[0]!);
    expect(audit.reason).toBe('Chain replacement');
    expect(audit.actor_id).toBe(boss.user.id);
  });

  it('B-2 a block over a booking is refused and names it; after moving the booking it succeeds', async () => {
    const w = await world(2);
    const b = await confirmed(alice, w, T10, 60);
    const unit = b.asset.id;

    const preview = (
      await call(
        boss,
        'GET',
        `/v1/admin/assets/${unit}/impact-preview?startsAt=${T10}&endsAt=${T12}`,
      )
    ).json<Impact>();
    expect(preview.clear).toBe(false);
    expect(preview.bookings.map((x) => x.bookingId)).toEqual([b.id]);
    expect(preview.bookings[0]!.customer).toBeTruthy();

    const refused = await block(unit, T10, T12);
    expect(refused.statusCode).toBe(409);
    const problem = refused.json<Problem>();
    expect(problem.code).toBe('HAS_FUTURE_BOOKINGS');
    expect(JSON.stringify(problem.errors)).toContain(b.id);
    expect(JSON.stringify(problem)).not.toContain('@'); // no customer details in the error
    expect((await call(boss, 'GET', `/v1/admin/assets/${unit}/blocks`)).json<Block[]>()).toEqual(
      [],
    );
    expect((await live(b.id))[0]!.asset_id).toBe(unit); // nothing was cancelled or moved for us

    expect((await reassign(b.id, { reason: 'Making room for repairs' })).statusCode).toBe(200);
    expect((await block(unit, T10, T12)).statusCode).toBe(201);
    const clear = (
      await call(
        boss,
        'GET',
        `/v1/admin/assets/${unit}/impact-preview?startsAt=${T14}&endsAt=${T16}`,
      )
    ).json<Impact>();
    expect(clear.clear).toBe(true);
  });

  it('B-3 overlapping blocks are refused; back-to-back blocks are fine', async () => {
    const w = await world(1);
    const unit = w.assetIds[0]!;
    expect((await block(unit, T10, T12)).statusCode).toBe(201);
    const overlap = await block(unit, '2030-01-09T05:30:00Z', T14);
    expect(overlap.statusCode).toBe(409);
    expect(overlap.json<Problem>().code).toBe('HAS_FUTURE_BOOKINGS');
    expect((await block(unit, T12, T14)).statusCode).toBe(201);
  });

  it('B-4 lifting a block frees the unit again; lifting twice is a 404; audited', async () => {
    const w = await world(1);
    const unit = w.assetIds[0]!;
    const created = (await block(unit, T10, T12)).json<Block>();
    expect((await book(alice, w, T10, 60)).statusCode).toBe(409);
    const lifted = await call(boss, 'DELETE', `/v1/admin/assets/${unit}/blocks/${created.id}`);
    expect(lifted.statusCode).toBe(204);
    expect((await book(alice, w, T10, 60)).statusCode).toBe(201);
    expect(
      (await call(boss, 'DELETE', `/v1/admin/assets/${unit}/blocks/${created.id}`)).statusCode,
    ).toBe(404);
    expect(await auditRows('asset.unblocked', unit)).toHaveLength(1);
    // The id of a booking occupancy is not a block.
    const bookingOccupancy = await database.pool.query(
      `SELECT id FROM asset_occupancies WHERE asset_id = $1 AND kind = 'booking' AND released_at IS NULL`,
      [unit],
    );
    expect(
      (await call(boss, 'DELETE', `/v1/admin/assets/${unit}/blocks/${bookingOccupancy.rows[0].id}`))
        .statusCode,
    ).toBe(404);
  });

  it('B-5 bad input is refused', async () => {
    const w = await world(1);
    const unit = w.assetIds[0]!;
    expect((await block(unit, T12, T10)).statusCode).toBe(422); // reversed
    expect((await block(unit, T10, T10)).statusCode).toBe(422); // empty
    expect((await block(unit, '2030-01-01T00:00:00Z', '2030-01-02T00:00:00Z')).statusCode).toBe(
      422,
    ); // in the past
    expect((await block(unit, T10, '2031-06-01T00:00:00Z')).statusCode).toBe(422); // longer than a year
    expect((await block(unit, T10, T12, { reason: 'x' })).statusCode).toBe(422);
    expect((await block(unit, T10, T12, { kind: 'transfer' })).statusCode).toBe(422);
    expect((await block(unit, 'tomorrow', T12)).statusCode).toBe(422);
    expect((await block('00000000-0000-4000-8000-000000000000', T10, T12)).statusCode).toBe(404);
    expect(
      (await call(boss, 'GET', `/v1/admin/assets/${unit}/impact-preview?startsAt=${T10}`))
        .statusCode,
    ).toBe(422);
    const rows = await database.pool.query(`SELECT 1 FROM asset_occupancies WHERE asset_id = $1`, [
      unit,
    ]);
    expect(rows.rowCount).toBe(0);
  });

  it('B-6 permissions and drawer scope', async () => {
    const w = await world(1);
    const elsewhere = await world(1);
    const unit = w.assetIds[0]!;
    const asReader = await registerSession(app, clock, 'x');
    await grantPermissions(database.pool, asReader.user.id, ['assets:read', 'bookings:read']);
    const asEditor = await registerSession(app, clock, 'x');
    await grantPermissions(
      database.pool,
      asEditor.user.id,
      ['assets:read', 'assets:write'],
      elsewhere.drawerId,
    );

    expect((await block(unit, T10, T12, {}, null)).statusCode).toBe(401);
    expect((await block(unit, T10, T12, {}, alice)).statusCode).toBe(403);
    expect((await block(unit, T10, T12, {}, asReader)).statusCode).toBe(403);
    expect((await block(unit, T10, T12, {}, asEditor)).statusCode).toBe(404); // another drawer's unit
    expect((await call(asEditor, 'GET', `/v1/admin/assets/${unit}/blocks`)).statusCode).toBe(404);
    expect((await call(asReader, 'GET', `/v1/admin/assets/${unit}/blocks`)).statusCode).toBe(200);
    expect(
      (
        await call(
          asReader,
          'GET',
          `/v1/admin/assets/${unit}/impact-preview?startsAt=${T10}&endsAt=${T12}`,
        )
      ).statusCode,
    ).toBe(200);
    expect((await call(alice, 'GET', `/v1/admin/assets/${unit}/blocks`)).statusCode).toBe(403);
    expect(
      (
        await call(
          boss,
          'DELETE',
          `/v1/admin/assets/${unit}/blocks/00000000-0000-4000-8000-000000000000`,
        )
      ).statusCode,
    ).toBe(404);
    const created = (await block(unit, T10, T12)).json<Block>();
    expect(
      (await call(asEditor, 'DELETE', `/v1/admin/assets/${unit}/blocks/${created.id}`)).statusCode,
    ).toBe(404);
    expect(
      (await call(asReader, 'DELETE', `/v1/admin/assets/${unit}/blocks/${created.id}`)).statusCode,
    ).toBe(403);
  });

  it('B-7 a block racing a booking for the only unit: exactly one wins, never both', async () => {
    for (let round = 0; round < 6; round += 1) {
      const w = await world(1);
      const [booked, blocked] = await Promise.all([
        book(alice, w, T10, 60),
        block(w.assetIds[0]!, T10, T12),
      ]);
      expect(
        [booked.statusCode, blocked.statusCode].filter((s) => s === 201 || s === 200),
      ).toHaveLength(1);
      expect([booked.statusCode, blocked.statusCode].filter((s) => s === 409)).toHaveLength(1);
      const overlapping = await database.pool.query(
        `SELECT count(*)::int AS n FROM asset_occupancies WHERE asset_id = $1 AND released_at IS NULL`,
        [w.assetIds[0]],
      );
      expect(overlapping.rows[0].n).toBe(1);
    }
  });

  it('B-8 a hold that already ran out does not stand in the way of a block', async () => {
    const w = await world(1);
    const held = (await book(alice, w, T10, 60)).json<Booking>();
    expect(held.status).toBe('held');
    clock.advance(11 * MIN);
    try {
      expect((await block(w.assetIds[0]!, T10, T12)).statusCode).toBe(201);
      const status = await database.pool.query('SELECT status FROM bookings WHERE id = $1', [
        held.id,
      ]);
      expect(status.rows[0].status).toBe('expired');
    } finally {
      clock.set(START);
    }
  });
});

// ── schedule ───────────────────────────────────────────────────────────────────────────────────────
describe('the schedule of a drawer', () => {
  it('S-1 shows each unit with its bookings (including the cleaning buffer) and blocks', async () => {
    const w = await world(2);
    const b = await confirmed(alice, w, T10, 60);
    const other = w.assetIds.find((id) => id !== b.asset.id)!;
    const created = (await block(other, T14, T16, { reason: 'Service' })).json<Block>();

    const res = await call(
      boss,
      'GET',
      `/v1/admin/drawers/${w.drawerId}/schedule?startsAt=2030-01-09T00:00:00Z&endsAt=2030-01-10T00:00:00Z`,
    );
    expect(res.statusCode, res.body).toBe(200);
    const schedule = res.json<Schedule>();
    expect(schedule.timezone).toBe('Asia/Kolkata');
    expect(schedule.assets.map((a) => a.assetId).sort()).toEqual([...w.assetIds].sort());

    const booked = schedule.assets.find((a) => a.assetId === b.asset.id)!.entries;
    expect(booked).toHaveLength(1);
    expect(booked[0]).toMatchObject({
      kind: 'booking',
      bookingId: b.id,
      bookingStatus: 'confirmed',
    });
    expect(booked[0]!.customer).toBeTruthy();
    expect(Date.parse(booked[0]!.blockedUntil) - Date.parse(b.endsAt)).toBe(15 * MIN); // buffer

    const blocked = schedule.assets.find((a) => a.assetId === other)!.entries;
    expect(blocked).toHaveLength(1);
    expect(blocked[0]).toMatchObject({
      kind: 'maintenance',
      blockId: created.id,
      reason: 'Service',
    });

    // A window that misses everything shows empty rows, not other days.
    const empty = (
      await call(
        boss,
        'GET',
        `/v1/admin/drawers/${w.drawerId}/schedule?startsAt=2030-01-12T00:00:00Z&endsAt=2030-01-13T00:00:00Z`,
      )
    ).json<Schedule>();
    expect(empty.assets.every((a) => a.entries.length === 0)).toBe(true);

    // A cancelled booking and a lifted block disappear.
    await call(alice, 'POST', `/v1/bookings/${b.id}/cancel`);
    await call(boss, 'DELETE', `/v1/admin/assets/${other}/blocks/${created.id}`);
    const after = (
      await call(
        boss,
        'GET',
        `/v1/admin/drawers/${w.drawerId}/schedule?startsAt=2030-01-09T00:00:00Z&endsAt=2030-01-10T00:00:00Z`,
      )
    ).json<Schedule>();
    expect(after.assets.every((a) => a.entries.length === 0)).toBe(true);
  });

  it('S-2 permissions, scope and window limits', async () => {
    const w = await world(1);
    const elsewhere = await world(1);
    const scoped = await registerSession(app, clock, 'x');
    await grantPermissions(database.pool, scoped.user.id, ['bookings:read'], elsewhere.drawerId);
    const url = (id: string, from = '2030-01-09T00:00:00Z', to = '2030-01-10T00:00:00Z') =>
      `/v1/admin/drawers/${id}/schedule?startsAt=${from}&endsAt=${to}`;
    expect((await call(undefined, 'GET', url(w.drawerId))).statusCode).toBe(401);
    expect((await call(alice, 'GET', url(w.drawerId))).statusCode).toBe(403);
    expect((await call(scoped, 'GET', url(w.drawerId))).statusCode).toBe(404);
    expect((await call(scoped, 'GET', url(elsewhere.drawerId))).statusCode).toBe(200);
    expect((await call(boss, 'GET', url('00000000-0000-4000-8000-000000000000'))).statusCode).toBe(
      404,
    );
    expect(
      (await call(boss, 'GET', url(w.drawerId, '2030-01-01T00:00:00Z', '2030-03-01T00:00:00Z')))
        .statusCode,
    ).toBe(422);
    expect(
      (await call(boss, 'GET', url(w.drawerId, '2030-01-10T00:00:00Z', '2030-01-09T00:00:00Z')))
        .statusCode,
    ).toBe(422);
  });
});

// ── reports, payments, settings ────────────────────────────────────────────────────────────────────
describe('reports, payments and settings', () => {
  it('P-1 the report adds up: counts, hours and money match what the bookings really cost', async () => {
    const mine = await world(3);
    const theirs = await world(1);
    const done = await confirmed(alice, mine, T10, 60);
    clock.set(T10);
    await call(boss, 'POST', `/v1/admin/bookings/${done.id}/pickup`);
    await call(boss, 'POST', `/v1/admin/bookings/${done.id}/return`);
    clock.set(START);
    const cancelled = await confirmed(bob, mine, T12, 60);
    await call(bob, 'POST', `/v1/bookings/${cancelled.id}/cancel`); // 100 % at this notice
    await confirmed(alice, mine, T14, 120);
    await confirmed(bob, theirs, T10, 60);

    const query = `from=2030-01-07T00:00:00Z&to=2030-01-08T00:00:00Z&drawerId=${mine.drawerId}`;
    const res = await call(boss, 'GET', `/v1/admin/reports/summary?${query}`);
    expect(res.statusCode, res.body).toBe(200);
    const report = res.json<{
      totals: Record<string, number>;
      days: Array<{ day: string; bookings: number; collectedPaise: number }>;
      drawers: Array<{ id: string; bookings: number; collectedPaise: number }>;
      models: Array<{ id: string; bookings: number; rentedHours: number }>;
    }>();
    const hour = 9800 + 20000; // 60 min rental + deposit
    const twoHours = 19600 + 20000;
    expect(report.totals).toMatchObject({
      bookings: 3,
      completed: 1,
      cancelled: 1,
      noShow: 0,
      rentedHours: 3, // the cancelled one does not count as rented
      collectedPaise: hour + hour + twoHours,
      refundedPaise: hour, // cancelled two days ahead: everything back
      netPaise: hour + twoHours,
    });
    expect(report.days).toEqual([
      { day: '2030-01-07', bookings: 3, collectedPaise: hour + hour + twoHours },
    ]);
    expect(report.drawers).toHaveLength(1);
    expect(report.drawers[0]).toMatchObject({ id: mine.drawerId, bookings: 3 });
    expect(report.models[0]).toMatchObject({ id: mine.modelId, bookings: 3, rentedHours: 3 });

    // Both drawers together; a window that excludes the bookings is empty.
    const all = (
      await call(
        boss,
        'GET',
        '/v1/admin/reports/summary?from=2030-01-07T00:00:00Z&to=2030-01-08T00:00:00Z',
      )
    ).json<{ totals: { bookings: number } }>();
    expect(all.totals.bookings).toBeGreaterThanOrEqual(4);
    const none = (
      await call(
        boss,
        'GET',
        `/v1/admin/reports/summary?from=2030-02-01T00:00:00Z&to=2030-02-02T00:00:00Z&drawerId=${mine.drawerId}`,
      )
    ).json<{ totals: { bookings: number; netPaise: number }; days: unknown[] }>();
    expect(none.totals).toMatchObject({ bookings: 0, netPaise: 0 });
    expect(none.days).toEqual([]);
  });

  it('P-2 the report and the ledger only cover the administrator’s drawers; permission and input checks', async () => {
    const mine = await world(1);
    const theirs = await world(1);
    await confirmed(alice, mine, T10, 60);
    await confirmed(bob, theirs, T10, 60);
    const scoped = await registerSession(app, clock, 'x');
    await grantPermissions(database.pool, scoped.user.id, ['reports:read'], mine.drawerId);
    const noReports = await registerSession(app, clock, 'x');
    await grantPermissions(database.pool, noReports.user.id, ['bookings:read']);

    const range = 'from=2030-01-07T00:00:00Z&to=2030-01-08T00:00:00Z';
    const seen = (
      await call(scoped, 'GET', `/v1/admin/reports/summary?${range}&drawerId=${mine.drawerId}`)
    ).json<{
      totals: { bookings: number };
    }>();
    expect(seen.totals.bookings).toBe(1);
    const other = (
      await call(scoped, 'GET', `/v1/admin/reports/summary?${range}&drawerId=${theirs.drawerId}`)
    ).json<{
      totals: { bookings: number };
    }>();
    expect(other.totals.bookings).toBe(0);
    const scopedAll = (await call(scoped, 'GET', `/v1/admin/reports/summary?${range}`)).json<{
      drawers: Array<{ id: string }>;
    }>();
    expect(scopedAll.drawers.map((d) => d.id)).toEqual([mine.drawerId]);

    expect((await call(undefined, 'GET', `/v1/admin/reports/summary?${range}`)).statusCode).toBe(
      401,
    );
    expect((await call(alice, 'GET', `/v1/admin/reports/summary?${range}`)).statusCode).toBe(403);
    expect((await call(noReports, 'GET', `/v1/admin/reports/summary?${range}`)).statusCode).toBe(
      403,
    );
    expect((await call(boss, 'GET', '/v1/admin/reports/summary')).statusCode).toBe(422);
    expect(
      (
        await call(
          boss,
          'GET',
          '/v1/admin/reports/summary?from=2030-01-08T00:00:00Z&to=2030-01-07T00:00:00Z',
        )
      ).statusCode,
    ).toBe(422);
    expect(
      (
        await call(
          boss,
          'GET',
          '/v1/admin/reports/summary?from=2028-01-01T00:00:00Z&to=2030-01-01T00:00:00Z',
        )
      ).statusCode,
    ).toBe(422);
  });

  it('P-3 the payments ledger lists payments with their refunds, filters and pages without gaps', async () => {
    const w = await world(4);
    const a = await confirmed(alice, w, T10, 60);
    await confirmed(bob, w, T12, 60);
    await confirmed(alice, w, T14, 60);
    await call(alice, 'POST', `/v1/bookings/${a.id}/cancel`);

    const first = (
      await call(boss, 'GET', `/v1/admin/payments?drawerId=${w.drawerId}&limit=2`)
    ).json<{
      items: Array<{
        id: string;
        bookingId: string;
        status: string;
        amountPaise: number;
        refundedPaise: number | null;
        refundStatus: string | null;
        provider: string;
        extension: boolean;
      }>;
      nextCursor: string | null;
    }>();
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    const second = (
      await call(
        boss,
        'GET',
        `/v1/admin/payments?drawerId=${w.drawerId}&limit=2&cursor=${first.nextCursor}`,
      )
    ).json<{ items: Array<{ id: string }>; nextCursor: string | null }>();
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    const ids = [...first.items, ...second.items].map((i) => i.id);
    expect(new Set(ids).size).toBe(3);

    const all = [...first.items, ...(await Promise.resolve(second.items as typeof first.items))];
    const refunded = (
      await call(boss, 'GET', `/v1/admin/payments?drawerId=${w.drawerId}&status=refunded`)
    ).json<{
      items: Array<{
        bookingId: string;
        refundedPaise: number;
        refundStatus: string;
        amountPaise: number;
      }>;
    }>();
    expect(refunded.items).toHaveLength(1);
    expect(refunded.items[0]).toMatchObject({
      bookingId: a.id,
      refundedPaise: 29800,
      refundStatus: 'processed',
      amountPaise: 29800,
    });
    expect(all.every((i) => i.provider === 'fake' && i.extension === false)).toBe(true);

    expect((await call(boss, 'GET', '/v1/admin/payments?status=weird')).statusCode).toBe(422);
    expect((await call(boss, 'GET', '/v1/admin/payments?cursor=garbage')).statusCode).toBe(422);
    expect((await call(alice, 'GET', '/v1/admin/payments')).statusCode).toBe(403);
    expect((await call(undefined, 'GET', '/v1/admin/payments')).statusCode).toBe(401);
  });

  it('P-4 settings show the rules in force and need settings:read', async () => {
    const reader = await registerSession(app, clock, 'x');
    await grantPermissions(database.pool, reader.user.id, ['settings:read']);
    const res = await call(reader, 'GET', '/v1/admin/settings');
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toMatchObject({
      holdMinutes: 10,
      paymentProvider: 'fake',
      paymentDemoMode: true,
      kycRequired: false,
      webhookConfigured: false,
    });
    expect(res.json<{ refundTiers: unknown[] }>().refundTiers.length).toBeGreaterThan(0);
    const body = res.body;
    expect(body).not.toMatch(/secret|key_id|password/i);
    expect((await call(alice, 'GET', '/v1/admin/settings')).statusCode).toBe(403);
    expect((await call(undefined, 'GET', '/v1/admin/settings')).statusCode).toBe(401);
    const noSettings = await registerSession(app, clock, 'x');
    await grantPermissions(database.pool, noSettings.user.id, ['reports:read']);
    expect((await call(noSettings, 'GET', '/v1/admin/settings')).statusCode).toBe(403);
  });
});

import { createHmac } from 'node:crypto';
import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BookingJobs } from '../../src/modules/booking';
import { razorpayWebhookSignature } from '../../src/modules/payments';
import { createFactories, type Factories } from '../factories';
import { makeSuperAdmin } from '../support/access';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeClock } from '../support/fake-clock';
import { type TestSession, freshSession, registerSession } from '../support/sessions';

const START = '2030-01-07T03:00:00Z'; // Monday 08:30 IST
const T10 = '2030-01-07T04:30:00Z';
const KEY_ID = 'rzp_test_demo';
const KEY_SECRET = 'rzp-secret-for-tests';
const WEBHOOK_SECRET = 'whsec-for-tests';

interface GatewayCall {
  method: string;
  path: string;
  authorization: string | undefined;
  body: Record<string, unknown>;
}
interface Booking {
  id: string;
  status: string;
}
interface Order {
  provider: string;
  orderId: string;
  amountPaise: number;
}

/** A local stand-in for api.razorpay.com: records every call and hands out ids. */
class FakeRazorpay {
  calls: GatewayCall[] = [];
  failCapture = false;
  private server: Server | undefined;
  private n = 0;

  async start(): Promise<string> {
    const server = createServer((req, res) => void this.handle(req, res));
    this.server = server;
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }
  async stop(): Promise<void> {
    const server = this.server;
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  of(suffix: string): GatewayCall[] {
    return this.calls.filter((c) => c.path.endsWith(suffix));
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const text = Buffer.concat(chunks).toString();
    const body = (text ? JSON.parse(text) : {}) as Record<string, unknown>;
    const path = req.url ?? '';
    this.calls.push({
      method: req.method ?? '',
      path,
      authorization: req.headers.authorization,
      body,
    });
    this.n += 1;
    if (path.endsWith('/capture') && this.failCapture) {
      res.writeHead(500).end('{}');
      return;
    }
    const prefix =
      path === '/v1/orders' ? 'order_T' : path.endsWith('/refund') ? 'rfnd_T' : 'pay_T';
    res
      .writeHead(200, { 'content-type': 'application/json' })
      .end(JSON.stringify({ id: `${prefix}${this.n}` }));
  }
}

let database: TestDatabase;
let app: TestApp;
let clock: FakeClock;
let f: Factories;
let jobs: BookingJobs;
let gateway: FakeRazorpay;
let boss: TestSession;
let alice: TestSession;
let counter = 0;

beforeAll(async () => {
  gateway = new FakeRazorpay();
  const baseUrl = await gateway.start();
  database = await createTestDatabase();
  f = createFactories(database.db);
  clock = new FakeClock(START);
  app = await createTestApp({
    config: testConfig({
      DATABASE_URL: database.url,
      PAYMENT_PROVIDER: 'razorpay',
      RAZORPAY_KEY_ID: KEY_ID,
      RAZORPAY_KEY_SECRET: KEY_SECRET,
      RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
      RAZORPAY_BASE_URL: baseUrl,
    }),
    clock,
  });
  jobs = app.app.get(BookingJobs);
  boss = await registerSession(app, clock, 'x');
  alice = await registerSession(app, clock, 'x');
  await makeSuperAdmin(database.pool, boss.user.id);
});
afterAll(async () => {
  await app.app.close();
  await database.drop();
  await gateway.stop();
});

const call = async (
  who: TestSession | undefined,
  method: 'GET' | 'POST',
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

async function world() {
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
    max_duration_min: 240,
    price_per_slot_paise: 4900,
    buffer_min: 15,
    deposit_paise: 20000,
  });
  await f.asset({
    drawer_id: drawer.id,
    item_model_id: model.id,
    asset_code: `Z-${(counter += 1)}`,
  });
  return { drawerId: drawer.id, modelId: model.id };
}
async function hold(startsAt = T10): Promise<{ booking: Booking; order: Order }> {
  const w = await world();
  const res = await call(
    alice,
    'POST',
    '/v1/bookings',
    { drawerId: w.drawerId, itemModelId: w.modelId, startsAt, durationMinutes: 60 },
    { 'idempotency-key': `k-${(counter += 1)}-${Date.now()}` },
  );
  expect(res.statusCode, res.body).toBe(201);
  const booking = res.json<Booking>();
  const order = (await call(alice, 'POST', `/v1/bookings/${booking.id}/payment`)).json<Order>();
  return { booking, order };
}
const status = async (id: string) =>
  (await database.pool.query('SELECT status FROM bookings WHERE id=$1', [id])).rows[0]
    .status as string;
const paymentStatus = async (orderId: string) =>
  (await database.pool.query('SELECT status FROM payments WHERE provider_order_id=$1', [orderId]))
    .rows[0].status as string;
const checkoutSignature = (orderId: string, paymentId: string) =>
  createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');

let eventNo = 0;
function event(type: string, orderId: string, paymentId: string) {
  const id = `evt_${(eventNo += 1)}`;
  return {
    id,
    body: JSON.stringify({
      entity: 'event',
      id,
      event: type,
      payload: { payment: { entity: { id: paymentId, order_id: orderId } } },
    }),
  };
}
const webhook = (
  raw: string,
  signature: string | null = razorpayWebhookSignature(raw, WEBHOOK_SECRET),
) =>
  app.app.inject({
    method: 'POST',
    url: '/v1/payments/webhooks/razorpay',
    headers: {
      'content-type': 'application/json',
      ...(signature !== null && { 'x-razorpay-signature': signature }),
    },
    payload: raw,
  });
const eventOutcome = async (id: string) =>
  (await database.pool.query('SELECT outcome FROM webhook_events WHERE event_id=$1', [id])).rows[0]
    ?.outcome as string | undefined;

describe('Razorpay gateway (against a local fake of its API)', () => {
  it('G-1 an order is created at the gateway with the right amount, manual capture and the key pair', async () => {
    const { order } = await hold();
    expect(order.provider).toBe('razorpay');
    expect(order.orderId).toMatch(/^order_T/);
    const created = gateway.of('/v1/orders').at(-1)!;
    expect(created.body).toMatchObject({
      amount: order.amountPaise,
      currency: 'INR',
      payment_capture: 0,
    });
    expect(created.authorization).toBe(
      `Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64')}`,
    );
  });

  it('G-2 the demo simulate endpoint does not exist with a real gateway', async () => {
    const { booking } = await hold();
    const res = await call(alice, 'POST', `/v1/bookings/${booking.id}/payment/simulate`);
    expect(res.statusCode).toBe(404);
  });

  it('G-3 the checkout result is verified with the key secret, then captured at the gateway', async () => {
    const { booking, order } = await hold();
    const paymentId = 'pay_checkout1';
    const bad = await call(alice, 'POST', `/v1/bookings/${booking.id}/payment/confirm`, {
      orderId: order.orderId,
      paymentId,
      signature: 'f'.repeat(64),
    });
    expect(bad.statusCode).toBe(422);
    expect(await status(booking.id)).toBe('held');

    const ok = await call(alice, 'POST', `/v1/bookings/${booking.id}/payment/confirm`, {
      orderId: order.orderId,
      paymentId,
      signature: checkoutSignature(order.orderId, paymentId),
    });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json<Booking>().status).toBe('confirmed');
    const captures = gateway.of(`/v1/payments/${paymentId}/capture`);
    expect(captures).toHaveLength(1);
    expect(captures[0]!.body).toMatchObject({ amount: order.amountPaise });
  });

  it('G-4 cancelling a paid booking refunds through the gateway', async () => {
    const { booking, order } = await hold('2030-01-09T04:30:00Z');
    const paymentId = 'pay_cancel1';
    const confirm = await call(alice, 'POST', `/v1/bookings/${booking.id}/payment/confirm`, {
      orderId: order.orderId,
      paymentId,
      signature: checkoutSignature(order.orderId, paymentId),
    });
    expect(confirm.statusCode, confirm.body).toBe(200);
    const res = await call(alice, 'POST', `/v1/bookings/${booking.id}/cancel`);
    expect(res.statusCode, res.body).toBe(200);
    const refunds = gateway.of(`/v1/payments/${paymentId}/refund`);
    expect(refunds).toHaveLength(1);
    expect(refunds[0]!.body['amount']).toBeGreaterThan(0);
    expect(String(refunds[0]!.body['receipt'])).toBeTruthy();
  });
});

describe('Razorpay webhooks', () => {
  it('W-1 a signed payment.authorized confirms a hold whose customer never came back — once', async () => {
    const { booking, order } = await hold();
    const ev = event('payment.authorized', order.orderId, 'pay_hook1');
    const res = await webhook(ev.body);
    expect(res.statusCode, res.body).toBe(200);
    expect(await status(booking.id)).toBe('confirmed');
    expect(await paymentStatus(order.orderId)).toBe('captured');
    expect(gateway.of('/v1/payments/pay_hook1/capture')).toHaveLength(1);

    // The gateway redelivers: nothing happens twice.
    expect((await webhook(ev.body)).statusCode).toBe(200);
    expect(gateway.of('/v1/payments/pay_hook1/capture')).toHaveLength(1);
    expect(await eventOutcome(ev.id)).toBe('applied');
    const events = await database.pool.query(
      `SELECT count(*)::int AS n FROM booking_events WHERE booking_id=$1 AND to_status='confirmed'`,
      [booking.id],
    );
    expect(events.rows[0].n).toBe(1);
  });

  it('W-2 a missing, wrong or tampered signature is refused and changes nothing', async () => {
    const { booking, order } = await hold();
    const ev = event('payment.authorized', order.orderId, 'pay_hook2');
    expect((await webhook(ev.body, null)).statusCode).toBe(401);
    expect((await webhook(ev.body, 'a'.repeat(64))).statusCode).toBe(401);
    const foreign = razorpayWebhookSignature(ev.body, 'someone-elses-secret');
    expect((await webhook(ev.body, foreign)).statusCode).toBe(401);
    const signed = razorpayWebhookSignature(ev.body, WEBHOOK_SECRET);
    expect((await webhook(ev.body.replace('pay_hook2', 'pay_evil'), signed)).statusCode).toBe(401);
    expect(await status(booking.id)).toBe('held');
    expect(await eventOutcome(ev.id)).toBeUndefined();
    expect(gateway.of('/v1/payments/pay_hook2/capture')).toHaveLength(0);
  });

  it('W-3 a signed body that is not an event is refused', async () => {
    // Not JSON at all: the framework's parser refuses it before any handler runs.
    expect((await webhook('not json')).statusCode).toBe(400);
    expect((await webhook('{"event":"payment.authorized"}')).statusCode).toBe(401);
  });

  it('W-4 events that carry no state change, or name an unknown order, are acknowledged and ignored', async () => {
    const { booking, order } = await hold();
    for (const [type, orderId] of [
      ['payment.failed', order.orderId],
      ['order.paid', order.orderId],
      ['payment.authorized', 'order_unknown'],
    ] as const) {
      const ev = event(type, orderId, 'pay_x');
      expect((await webhook(ev.body)).statusCode).toBe(200);
      expect(await eventOutcome(ev.id)).toBe('ignored');
    }
    expect(await status(booking.id)).toBe('held');
  });

  it('W-5 payment for a booking cancelled meanwhile is not confirmed or captured', async () => {
    const { booking, order } = await hold();
    await call(alice, 'POST', `/v1/bookings/${booking.id}/cancel`);
    const ev = event('payment.authorized', order.orderId, 'pay_late_cancel');
    expect((await webhook(ev.body)).statusCode).toBe(200);
    expect(await status(booking.id)).toBe('cancelled');
    expect(gateway.of('/v1/payments/pay_late_cancel/capture')).toHaveLength(0);
    expect(await eventOutcome(ev.id)).toBe('ignored');
  });

  it('W-6 payment after the hold ran out still confirms while the slot is free', async () => {
    const late = await hold();
    clock.advance(11 * 60_000);
    await jobs.runOnce();
    expect(await status(late.booking.id)).toBe('expired');
    const res = await webhook(event('payment.authorized', late.order.orderId, 'pay_late').body);
    expect(res.statusCode).toBe(200);
    expect(await status(late.booking.id)).toBe('confirmed');
    clock.set(START);
  });

  it('W-7 if the gateway refuses the capture nothing is confirmed and a redelivery can try again', async () => {
    const { booking, order } = await hold();
    const ev = event('payment.authorized', order.orderId, 'pay_capfail');
    gateway.failCapture = true;
    const failed = await webhook(ev.body);
    gateway.failCapture = false;
    expect(failed.statusCode).toBeGreaterThanOrEqual(500);
    expect(await status(booking.id)).toBe('held');
    expect(await eventOutcome(ev.id)).toBeUndefined();
    expect((await webhook(ev.body)).statusCode).toBe(200);
    expect(await status(booking.id)).toBe('confirmed');
  });

  it('W-8 parallel deliveries of one event confirm exactly once', async () => {
    const { booking, order } = await hold();
    const ev = event('payment.authorized', order.orderId, 'pay_par');
    const results = await Promise.all(Array.from({ length: 6 }, () => webhook(ev.body)));
    expect(results.every((r) => r.statusCode === 200)).toBe(true);
    expect(await status(booking.id)).toBe('confirmed');
    expect(gateway.of('/v1/payments/pay_par/capture')).toHaveLength(1);
  });
});

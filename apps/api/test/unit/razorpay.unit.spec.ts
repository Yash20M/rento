import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/app-config';
import {
  RazorpayPaymentProvider,
  razorpayWebhookSignature,
  verifyRazorpayWebhook,
} from '../../src/modules/payments';

interface Seen {
  url: string;
  method: string;
  auth: string | null;
  body: Record<string, unknown>;
}

function provider(respond: (seen: Seen) => { status: number; json: unknown }) {
  const calls: Seen[] = [];
  const fetchFake = (async (url: string, init: RequestInit) => {
    const seen: Seen = {
      url,
      method: String(init.method),
      auth: new Headers(init.headers).get('authorization'),
      body: JSON.parse(String(init.body)) as Record<string, unknown>,
    };
    calls.push(seen);
    const { status, json } = respond(seen);
    return new Response(JSON.stringify(json), { status });
  }) as unknown as typeof fetch;
  return {
    calls,
    razorpay: new RazorpayPaymentProvider({
      keyId: 'rzp_test_key',
      keySecret: 'secret-1',
      baseUrl: 'https://rzp.test/',
      fetch: fetchFake,
    }),
  };
}

describe('Razorpay adapter', () => {
  it('R-1 creates an order in paise with manual capture and basic auth', async () => {
    const { razorpay, calls } = provider(() => ({ status: 200, json: { id: 'order_A1' } }));
    await expect(razorpay.createOrder({ amountPaise: 12345, receipt: 'bk-1' })).resolves.toEqual({
      orderId: 'order_A1',
    });
    expect(calls[0]).toMatchObject({
      url: 'https://rzp.test/v1/orders',
      method: 'POST',
      body: { amount: 12345, currency: 'INR', receipt: 'bk-1', payment_capture: 0 },
    });
    expect(calls[0]!.auth).toBe(`Basic ${Buffer.from('rzp_test_key:secret-1').toString('base64')}`);
  });

  it('R-2 checkout signature = HMAC(order|payment, key secret); anything else is refused', () => {
    const { razorpay } = provider(() => ({ status: 200, json: {} }));
    const good = createHmac('sha256', 'secret-1').update('order_A1|pay_B2').digest('hex');
    expect(
      razorpay.verifyPayment({ orderId: 'order_A1', paymentId: 'pay_B2', signature: good }),
    ).toBe(true);
    expect(
      razorpay.verifyPayment({ orderId: 'order_A1', paymentId: 'pay_B3', signature: good }),
    ).toBe(false);
    expect(
      razorpay.verifyPayment({ orderId: 'order_X', paymentId: 'pay_B2', signature: good }),
    ).toBe(false);
    expect(
      razorpay.verifyPayment({ orderId: 'order_A1', paymentId: 'pay_B2', signature: 'zz' }),
    ).toBe(false);
    const other = createHmac('sha256', 'not-the-secret').update('order_A1|pay_B2').digest('hex');
    expect(
      razorpay.verifyPayment({ orderId: 'order_A1', paymentId: 'pay_B2', signature: other }),
    ).toBe(false);
  });

  it('R-3 captures and refunds the right payment with the right amounts', async () => {
    const { razorpay, calls } = provider((s) => ({
      status: 200,
      json: { id: s.url.endsWith('/refund') ? 'rfnd_1' : 'pay_B2' },
    }));
    await razorpay.capture({ paymentId: 'pay_B2', amountPaise: 500 });
    await expect(
      razorpay.refund({ paymentId: 'pay_B2', amountPaise: 250, idempotencyKey: 'refund:abc' }),
    ).resolves.toEqual({ refundId: 'rfnd_1' });
    expect(calls[0]).toMatchObject({
      url: 'https://rzp.test/v1/payments/pay_B2/capture',
      body: { amount: 500, currency: 'INR' },
    });
    expect(calls[1]).toMatchObject({
      url: 'https://rzp.test/v1/payments/pay_B2/refund',
      body: { amount: 250, receipt: 'refund:abc' },
    });
  });

  it('R-4 a gateway failure throws without echoing the response body', async () => {
    const { razorpay } = provider(() => ({
      status: 400,
      json: { error: { description: 'card 4111111111111111 declined' } },
    }));
    const error = await razorpay
      .createOrder({ amountPaise: 1, receipt: 'x' })
      .catch((e: unknown) => e);
    expect(String(error)).toContain('HTTP 400');
    expect(String(error)).not.toContain('4111');
  });

  it('R-5 webhook signature = HMAC-SHA256 of the raw bytes; one changed byte fails it', () => {
    const body = Buffer.from('{"id":"evt_1","event":"payment.authorized"}');
    const signature = razorpayWebhookSignature(body, 'whsec');
    expect(signature).toBe(createHmac('sha256', 'whsec').update(body).digest('hex'));
    expect(verifyRazorpayWebhook(body, signature, 'whsec')).toBe(true);
    expect(verifyRazorpayWebhook(Buffer.from(`${body.toString()} `), signature, 'whsec')).toBe(
      false,
    );
    expect(verifyRazorpayWebhook(body, signature, 'other')).toBe(false);
    expect(verifyRazorpayWebhook(body, '', 'whsec')).toBe(false);
  });
});

describe('payment provider configuration', () => {
  const base = { DATABASE_URL: 'postgres://u:p@h/d', JWT_SECRET: 'x'.repeat(40) };
  it('R-6 razorpay needs all three secrets', () => {
    expect(() => loadConfig({ ...base, PAYMENT_PROVIDER: 'razorpay' })).toThrow(/RAZORPAY_KEY_ID/);
    expect(() =>
      loadConfig({
        ...base,
        PAYMENT_PROVIDER: 'razorpay',
        RAZORPAY_KEY_ID: 'k',
        RAZORPAY_KEY_SECRET: 's',
      }),
    ).toThrow(/RAZORPAY_WEBHOOK_SECRET/);
    const config = loadConfig({
      ...base,
      PAYMENT_PROVIDER: 'razorpay',
      RAZORPAY_KEY_ID: 'k',
      RAZORPAY_KEY_SECRET: 's',
      RAZORPAY_WEBHOOK_SECRET: 'w',
    });
    expect(config.paymentProvider).toBe('razorpay');
  });
  it('R-7 the fake gateway is the default and an unknown one is refused', () => {
    expect(loadConfig(base).paymentProvider).toBe('fake');
    expect(() => loadConfig({ ...base, PAYMENT_PROVIDER: 'stripe' })).toThrow(/fake or razorpay/);
  });
});

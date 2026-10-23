import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PaymentProvider } from './payment-provider';

export interface RazorpayOptions {
  keyId: string;
  keySecret: string;
  /** API origin; overridable so tests can point it at a local fake. */
  baseUrl?: string;
  fetch?: typeof fetch;
}

const safeEqualHex = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

/** Razorpay's webhook signature: HMAC-SHA256 of the RAW request body with the webhook secret, hex. */
export const razorpayWebhookSignature = (rawBody: string | Buffer, webhookSecret: string): string =>
  createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

export const verifyRazorpayWebhook = (
  rawBody: string | Buffer,
  signature: string,
  webhookSecret: string,
): boolean => safeEqualHex(razorpayWebhookSignature(rawBody, webhookSecret), signature);

/**
 * Razorpay adapter (README §9.5). Orders, capture and refunds go through Razorpay's REST API with HTTP basic auth;
 * the checkout result is verified locally: `razorpay_signature = HMAC-SHA256(order_id + "|" + payment_id, key_secret)`.
 *
 * NOTE (assumption to confirm against the Razorpay sandbox once keys exist — no keys were available when this was
 * written): endpoint paths/fields follow Razorpay's public documentation; the refund idempotency key is sent as the
 * refund `receipt`. The adapter is tested against a local fake of those endpoints.
 */
export class RazorpayPaymentProvider implements PaymentProvider {
  readonly name = 'razorpay';
  private readonly base: string;
  private readonly http: typeof fetch;
  private readonly auth: string;

  constructor(private readonly options: RazorpayOptions) {
    this.base = (options.baseUrl ?? 'https://api.razorpay.com').replace(/\/+$/, '');
    this.http = options.fetch ?? fetch;
    this.auth = `Basic ${Buffer.from(`${options.keyId}:${options.keySecret}`).toString('base64')}`;
  }

  /** The public key id the checkout SDK needs (never the secret). */
  get keyId(): string {
    return this.options.keyId;
  }

  async createOrder(input: { amountPaise: number; receipt: string }): Promise<{ orderId: string }> {
    const order = await this.call<{ id: string }>('POST', '/v1/orders', {
      amount: input.amountPaise,
      currency: 'INR',
      receipt: input.receipt.slice(0, 40),
      // Authorise now, capture only after the booking is confirmed (README §9.5).
      payment_capture: 0,
    });
    return { orderId: order.id };
  }

  verifyPayment(input: { orderId: string; paymentId: string; signature: string }): boolean {
    const expected = createHmac('sha256', this.options.keySecret)
      .update(`${input.orderId}|${input.paymentId}`)
      .digest('hex');
    return safeEqualHex(expected, input.signature);
  }

  async capture(input: { paymentId: string; amountPaise: number }): Promise<void> {
    await this.call('POST', `/v1/payments/${encodeURIComponent(input.paymentId)}/capture`, {
      amount: input.amountPaise,
      currency: 'INR',
    });
  }

  async refund(input: {
    paymentId: string;
    amountPaise: number;
    idempotencyKey: string;
  }): Promise<{ refundId: string }> {
    const refund = await this.call<{ id: string }>(
      'POST',
      `/v1/payments/${encodeURIComponent(input.paymentId)}/refund`,
      { amount: input.amountPaise, speed: 'normal', receipt: input.idempotencyKey.slice(0, 40) },
    );
    return { refundId: refund.id };
  }

  private async call<T = unknown>(method: string, path: string, body: unknown): Promise<T> {
    const response = await this.http(`${this.base}${path}`, {
      method,
      headers: { authorization: this.auth, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      // The body may echo request details: log only the status.
      throw new Error(
        `Razorpay ${method} ${path.replace(/\/pay_[^/]+/, '/pay_…')} failed: HTTP ${response.status}`,
      );
    }
    return (await response.json()) as T;
  }
}

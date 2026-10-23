import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { PaymentProvider } from './payment-provider';

/**
 * A gateway that lives inside the API process, for development, demos and tests. Signatures are HMAC-SHA256 over
 * `orderId|paymentId` with a key derived from the server secret, so a client cannot make one up — the same shape of
 * check the real gateway needs. `simulateCheckout` plays the part of the payment screen.
 */
export class FakePaymentProvider implements PaymentProvider {
  readonly name = 'fake';
  private readonly key: Buffer;

  constructor(secret: string) {
    this.key = createHmac('sha256', secret).update('rento-fake-payment-provider').digest();
  }

  async createOrder(): Promise<{ orderId: string }> {
    return { orderId: `fake_order_${randomUUID()}` };
  }

  simulateCheckout(orderId: string): { orderId: string; paymentId: string; signature: string } {
    const paymentId = `fake_pay_${randomUUID()}`;
    return { orderId, paymentId, signature: this.sign(orderId, paymentId) };
  }

  verifyPayment(input: { orderId: string; paymentId: string; signature: string }): boolean {
    const expected = Buffer.from(this.sign(input.orderId, input.paymentId));
    const given = Buffer.from(input.signature);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  async capture(): Promise<void> {
    // Nothing to do: the fake gateway captures instantly.
  }

  async refund(): Promise<{ refundId: string }> {
    return { refundId: `fake_refund_${randomUUID()}` };
  }

  private sign(orderId: string, paymentId: string): string {
    return createHmac('sha256', this.key).update(`${orderId}|${paymentId}`).digest('hex');
  }
}

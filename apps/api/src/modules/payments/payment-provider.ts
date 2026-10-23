export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

/**
 * The payment gateway as the booking engine sees it (README §9.5, §12.3). The only implementation today is the
 * in-process {@link FakePaymentProvider}; the Razorpay adapter (P4-01) implements this same interface.
 */
export interface PaymentProvider {
  readonly name: string;
  createOrder(input: { amountPaise: number; receipt: string }): Promise<{ orderId: string }>;
  /** Is this (order, payment, signature) triple genuine? A client saying "I paid" is never enough. */
  verifyPayment(input: { orderId: string; paymentId: string; signature: string }): boolean;
  capture(input: { paymentId: string; amountPaise: number }): Promise<void>;
  /** `idempotencyKey` makes a retried refund harmless. */
  refund(input: {
    paymentId: string;
    amountPaise: number;
    idempotencyKey: string;
  }): Promise<{ refundId: string }>;
}

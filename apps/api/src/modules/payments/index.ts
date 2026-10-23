// Public surface of the payments module (README §12.3).
export { PaymentsModule } from './payments.module';
export { PAYMENT_PROVIDER, type PaymentProvider } from './payment-provider';
export { FakePaymentProvider } from './fake-payment-provider';
export { PaymentRepository, type PaymentRow, type RefundRow } from './payment.repository';
export {
  RazorpayPaymentProvider,
  razorpayWebhookSignature,
  verifyRazorpayWebhook,
} from './razorpay-payment-provider';

import { Module } from '@nestjs/common';
import type { AppConfig } from '../../config/app-config';
import { APP_CONFIG } from '../../config/config.module';
import { FakePaymentProvider } from './fake-payment-provider';
import { PAYMENT_PROVIDER, type PaymentProvider } from './payment-provider';
import { PaymentRepository } from './payment.repository';
import { RazorpayPaymentProvider } from './razorpay-payment-provider';

/** Payment gateway adapter and the payment/refund tables (README §9.5, §12.3). */
@Module({
  providers: [
    PaymentRepository,
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (config: AppConfig): PaymentProvider =>
        config.paymentProvider === 'razorpay'
          ? new RazorpayPaymentProvider({
              keyId: config.razorpayKeyId ?? '',
              keySecret: config.razorpayKeySecret ?? '',
              ...(config.razorpayBaseUrl !== undefined && { baseUrl: config.razorpayBaseUrl }),
            })
          : new FakePaymentProvider(config.jwtSecret),
      inject: [APP_CONFIG],
    },
  ],
  exports: [PaymentRepository, PAYMENT_PROVIDER],
})
export class PaymentsModule {}

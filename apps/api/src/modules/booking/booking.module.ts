import { Module } from '@nestjs/common';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { DrawersModule } from '../drawers';
import { InventoryModule } from '../inventory';
import { KycModule } from '../kyc';
import { PaymentsModule } from '../payments';
import { BookingRepository } from './data/booking.repository';
import { AdminBookingsController } from './http/admin-bookings.controller';
import { AdminDashboardController } from './http/admin-dashboard.controller';
import { AdminOpsController } from './http/admin-ops.controller';
import { AdminReportsController } from './http/admin-reports.controller';
import { BookingsController } from './http/bookings.controller';
import { PaymentWebhookController } from './http/payment-webhook.controller';
import { AdminBookingService } from './services/admin-booking.service';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminOpsService } from './services/admin-ops.service';
import { AdminReportsService } from './services/admin-reports.service';
import { BookingExtensionService } from './services/booking-extension.service';
import { BookingJobs } from './services/booking-jobs';
import { BookingLifecycleService } from './services/booking-lifecycle.service';
import { BookingPaymentService } from './services/booking-payment.service';
import { PaymentWebhookService } from './services/payment-webhook.service';
import { BookingService } from './services/booking.service';
import { HoldExpiryService } from './services/hold-expiry.service';
import { BookingNotifications } from './services/booking-notifications';
import { OutboxDispatcher } from './services/outbox-dispatcher';

/** Holds, payment confirmation, cancellation, hand-over, expiry sweeps and the outbox (README §9). */
@Module({
  imports: [DrawersModule, InventoryModule, PaymentsModule, KycModule],
  controllers: [
    BookingsController,
    AdminBookingsController,
    AdminDashboardController,
    AdminOpsController,
    AdminReportsController,
    PaymentWebhookController,
  ],
  providers: [
    BookingRepository,
    IdempotencyService,
    HoldExpiryService,
    BookingService,
    BookingPaymentService,
    PaymentWebhookService,
    BookingLifecycleService,
    AdminBookingService,
    AdminDashboardService,
    AdminOpsService,
    AdminReportsService,
    OutboxDispatcher,
    BookingJobs,
    BookingNotifications,
    BookingExtensionService,
  ],
  exports: [BookingJobs, OutboxDispatcher],
})
export class BookingModule {}

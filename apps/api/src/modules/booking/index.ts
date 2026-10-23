// Public surface of the booking module (README §12.3).
export { BookingModule } from './booking.module';
export { BookingJobs, type JobsReport } from './services/booking-jobs';
export { OutboxDispatcher, type OutboxHandler } from './services/outbox-dispatcher';

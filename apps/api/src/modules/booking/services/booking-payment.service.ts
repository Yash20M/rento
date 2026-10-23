import { Inject, Injectable } from '@nestjs/common';
import { type Kysely, sql } from 'kysely';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import { AppError } from '../../../common/errors/app-error';
import { pgErrorCode } from '../../../db/errors';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { type Tx, withTransaction } from '../../../db/transaction';
import {
  FakePaymentProvider,
  PAYMENT_PROVIDER,
  PaymentRepository,
  type PaymentProvider,
  type PaymentRow,
} from '../../payments';
import { BookingRepository, type BookingRow } from '../data/booking.repository';
import {
  MINUTE_MS,
  bookingNotFound,
  holdExpired,
  invalidState,
  paymentInvalid,
} from '../domain/booking-rules';
import type { BookingDto, PaymentOrderDto, SimulatedCheckoutDto } from '../http/bookings.dto';
import { BookingService } from './booking.service';

/**
 * Pay for a hold and confirm it (README §9.5). A booking becomes `confirmed` only here, after the gateway signature
 * is verified on the server — never because the app says "I paid".
 */
@Injectable()
export class BookingPaymentService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly bookings: BookingRepository,
    private readonly payments: PaymentRepository,
    private readonly service: BookingService,
  ) {}

  /** The order the customer pays for this hold. Asking again returns the same order. */
  async createOrder(userId: string, id: string): Promise<PaymentOrderDto> {
    return withTransaction(this.db, async (trx) => {
      const row = await this.owned(trx, userId, id);
      if (row.status !== 'held') {
        throw invalidState(
          row.status === 'expired'
            ? 'The hold ran out; make a new booking'
            : `A ${row.status.replace('_', ' ')} booking cannot be paid for`,
        );
      }
      if (row.hold_expires_at && row.hold_expires_at.getTime() <= this.clock.now().getTime()) {
        throw holdExpired();
      }
      const amountPaise = row.price_paise + row.deposit_paise;
      const existing = await this.payments.openForBooking(trx, id);
      const payment =
        existing ??
        (await this.payments.insert(trx, {
          bookingId: id,
          provider: this.provider.name,
          orderId: (await this.provider.createOrder({ amountPaise, receipt: id })).orderId,
          amountPaise,
        }));
      return {
        provider: payment.provider,
        orderId: payment.provider_order_id,
        amountPaise: payment.amount_paise,
        currency: 'INR',
        holdExpiresAt: row.hold_expires_at?.toISOString() ?? null,
      };
    });
  }

  /** Development/demo only: plays the part of the gateway's checkout screen and returns what it would hand the app. */
  async simulateCheckout(userId: string, id: string): Promise<SimulatedCheckoutDto> {
    if (!(this.provider instanceof FakePaymentProvider)) throw bookingNotFound();
    const row = await this.owned(this.db, userId, id);
    const payment = await this.payments.openForBooking(this.db, row.id);
    if (!payment || payment.status !== 'created') {
      throw invalidState('Create the payment order first');
    }
    return this.provider.simulateCheckout(payment.provider_order_id);
  }

  async confirm(
    userId: string,
    id: string,
    proof: { orderId: string; paymentId: string; signature: string },
  ): Promise<BookingDto> {
    await withTransaction(this.db, async (trx) => {
      const row = await this.owned(trx, userId, id, true);
      const payment = await this.payments.openForBooking(trx, id);
      if (!payment || payment.provider_order_id !== proof.orderId) throw paymentInvalid();
      if (!this.provider.verifyPayment(proof)) throw paymentInvalid();

      // Confirming twice is harmless.
      if (row.status === 'confirmed' && payment.provider_payment_id === proof.paymentId) return;

      await this.settle(trx, row, payment, proof.paymentId, userId);
    });
    return this.service.present(this.db, id);
  }

  /**
   * The gateway reported (by webhook) that an order was paid. Same outcome as the customer's own confirmation, minus
   * the checkout signature: the webhook signature was verified before this is called. Returns what happened ("applied" or why not): the booking
   * cannot be confirmed any more (cancelled, or the hold ran out and the slot is gone) — nothing is captured then.
   */
  async confirmFromGateway(trx: Tx, orderId: string, paymentId: string): Promise<string> {
    const payment = await trx
      .selectFrom('payments')
      .selectAll()
      .where('provider', '=', this.provider.name)
      .where('provider_order_id', '=', orderId)
      .where('extension_id', 'is', null)
      .executeTakeFirst();
    if (!payment) return 'unknown order';
    const row = await this.bookings.lock(trx, payment.booking_id);
    if (!row) return 'unknown booking';
    if (payment.status !== 'created') return 'already settled';
    await sql`SAVEPOINT webhook_settle`.execute(trx);
    try {
      await this.settle(trx, row, payment, paymentId, row.user_id);
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      await sql`ROLLBACK TO SAVEPOINT webhook_settle`.execute(trx);
      return error.code;
    }
    await sql`RELEASE SAVEPOINT webhook_settle`.execute(trx);
    return 'applied';
  }

  /** Marks a hold (or a late-paid expired hold) confirmed and captures the money. Runs inside the caller's transaction. */
  private async settle(
    trx: Tx,
    row: BookingRow,
    payment: PaymentRow,
    paymentId: string,
    userId: string,
  ): Promise<void> {
    const id = row.id;
    const proof = { paymentId };
    const now = this.clock.now();
    if (row.status === 'expired') {
      // Late payment (README §9.5): the slot may still be free. The exclusion constraint decides.
      await this.retakeSlot(trx, row);
    } else if (row.status !== 'held') {
      throw invalidState(`A ${row.status.replace('_', ' ')} booking cannot be confirmed`);
    }

    await this.provider.capture({
      paymentId: proof.paymentId,
      amountPaise: payment.amount_paise,
    });
    await this.payments.markCaptured(trx, payment.id, proof.paymentId);
    await this.bookings.setStatus(trx, id, 'confirmed', { holdExpiresAt: null });
    await this.bookings.insertEvent(trx, {
      bookingId: id,
      from: row.status,
      to: 'confirmed',
      actorId: userId,
      note:
        row.status === 'expired' ? 'Paid after the hold ran out; the slot was still free' : null,
      at: now,
    });
    await this.bookings.insertOutbox(
      trx,
      'booking.confirmed',
      { bookingId: id, userId, amountPaise: payment.amount_paise },
      now,
    );
  }

  private async retakeSlot(trx: Tx, row: BookingRow) {
    const asset = await trx
      .selectFrom('assets')
      .select('status')
      .where('id', '=', row.asset_id)
      .forUpdate()
      .executeTakeFirst();
    if (asset?.status !== 'available') throw holdExpired();
    await sql`SAVEPOINT retake`.execute(trx);
    try {
      await this.bookings.insertOccupancy(
        trx,
        row.id,
        row.asset_id,
        row.starts_at,
        new Date(row.ends_at.getTime() + row.buffer_min * MINUTE_MS),
      );
    } catch (error) {
      if (pgErrorCode(error) !== '23P01') throw error;
      await sql`ROLLBACK TO SAVEPOINT retake`.execute(trx);
      throw holdExpired();
    }
    await sql`RELEASE SAVEPOINT retake`.execute(trx);
  }

  private async owned(
    db: Kysely<Database>,
    userId: string,
    id: string,
    lock = false,
  ): Promise<BookingRow> {
    const row = lock
      ? await this.bookings.lock(db, id)
      : await db.selectFrom('bookings').selectAll().where('id', '=', id).executeTakeFirst();
    if (!row || row.user_id !== userId) throw bookingNotFound();
    return row;
  }
}

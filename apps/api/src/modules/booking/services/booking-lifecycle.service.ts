import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/config.module';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { type Tx, withTransaction } from '../../../db/transaction';
import { type DrawerAccess, accessIncludes } from '../../access-control';
import { PAYMENT_PROVIDER, PaymentRepository, type PaymentProvider } from '../../payments';
import { type Actor, AuditLog } from '../../reporting-audit';
import { BookingRepository, type BookingRow } from '../data/booking.repository';
import {
  type BookingStatus,
  MINUTE_MS,
  bookingNotFound,
  canTransition,
  invalidState,
  permissionDenied,
  refundAmount,
  refundPercent,
} from '../domain/booking-rules';
import type { BookingDto } from '../http/bookings.dto';
import { BookingService } from './booking.service';

export interface CancelOptions {
  /** `null` for the customer; the audited staff actor otherwise. */
  staff: Actor | null;
  reason?: string | undefined;
  /** Staff override of the refund percentage of the rental price. */
  refundPercent?: number | undefined;
  /** Throws when the caller may not override the refund of this booking. */
  checkOverride?: (row: BookingRow) => void;
}

/** Cancel, hand over and take back (README §9.8, §7.2). Every change locks the booking row first. */
@Injectable()
export class BookingLifecycleService {
  private readonly log = new Logger(BookingLifecycleService.name);

  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly bookings: BookingRepository,
    private readonly payments: PaymentRepository,
    private readonly service: BookingService,
    private readonly audit: AuditLog,
  ) {}

  /** The customer cancels their own booking. Cancelling twice is harmless. */
  cancelOwn(userId: string, id: string): Promise<BookingDto> {
    return this.cancel(id, { staff: null }, (row) => row.user_id === userId, userId);
  }

  /** Staff cancel with a reason; the audit row is written in the same transaction. */
  cancelAsStaff(
    actor: Actor,
    access: DrawerAccess,
    refundAccess: DrawerAccess,
    id: string,
    reason: string,
    percent: number | undefined,
  ): Promise<BookingDto> {
    return this.cancel(
      id,
      {
        staff: actor,
        reason,
        refundPercent: percent,
        checkOverride: (row) => {
          if (percent !== undefined && !accessIncludes(refundAccess, row.drawer_id)) {
            throw permissionDenied();
          }
        },
      },
      (row) => accessIncludes(access, row.drawer_id),
      actor.id,
    );
  }

  private async cancel(
    id: string,
    options: CancelOptions,
    allowed: (row: BookingRow) => boolean,
    actorId: string | null,
  ): Promise<BookingDto> {
    const refundId = await withTransaction(this.db, async (trx) => {
      const row = await this.bookings.lock(trx, id);
      if (!row || !allowed(row)) throw bookingNotFound();
      options.checkOverride?.(row);
      if (row.status === 'cancelled') return undefined; // already done: report the current state
      const from = row.status as BookingStatus;
      if (!canTransition(from, 'cancelled')) {
        throw invalidState(
          from === 'active' || from === 'overdue'
            ? 'The rental has started and can no longer be cancelled'
            : `A ${from.replace('_', ' ')} booking cannot be cancelled`,
        );
      }
      const now = this.clock.now();
      await this.bookings.setStatus(trx, id, 'cancelled', {
        holdExpiresAt: null,
        cancelledBy: actorId,
        cancelReason: options.reason ?? null,
      });
      await this.bookings.releaseOccupancy(trx, id, now);

      let refund: { id: string; amountPaise: number } | undefined;
      if (from === 'held') {
        await this.payments.failUnpaid(trx, id);
      } else {
        refund = await this.refundFor(trx, row, now, options.refundPercent);
      }
      await this.bookings.insertEvent(trx, {
        bookingId: id,
        from,
        to: 'cancelled',
        actorId,
        note: options.reason ?? null,
        meta: refund ? { refundPaise: refund.amountPaise } : undefined,
        at: now,
      });
      await this.bookings.insertOutbox(
        trx,
        'booking.cancelled',
        { bookingId: id, userId: row.user_id, refundPaise: refund?.amountPaise ?? 0 },
        now,
      );
      if (options.staff) {
        await this.audit.record(trx, {
          actor: options.staff,
          action: 'booking.cancelled',
          entityType: 'booking',
          entityId: id,
          before: { status: from },
          after: { status: 'cancelled', refundPaise: refund?.amountPaise ?? 0 },
          ...(options.reason !== undefined && { reason: options.reason }),
        });
      }
      return refund?.id;
    });
    if (refundId) await this.settleRefund(refundId);
    return this.service.present(this.db, id);
  }

  /** Creates the single refund row of a paid booking; `undefined` when nothing is refundable. */
  private async refundFor(
    trx: Tx,
    row: BookingRow,
    now: Date,
    override: number | undefined,
  ): Promise<{ id: string; amountPaise: number } | undefined> {
    const payment = await this.payments.openForBooking(trx, row.id);
    if (!payment || payment.status !== 'captured') return undefined;
    const minutes = (row.starts_at.getTime() - now.getTime()) / MINUTE_MS;
    const percent = override ?? refundPercent(minutes, this.config.refundTiers);
    const amountPaise = refundAmount(row.price_paise, row.deposit_paise, percent);
    if (amountPaise === 0) return undefined;
    const created = await this.payments.insertRefund(trx, {
      bookingId: row.id,
      paymentId: payment.id,
      amountPaise,
      reason:
        override === undefined
          ? `cancelled ${Math.round(minutes)} min before start`
          : 'staff override',
    });
    return created ? { id: created.id, amountPaise } : undefined;
  }

  /**
   * Hands a pending refund to the gateway. Called after the booking transaction commits; if the gateway is down the
   * refund stays `pending` and the background sweep retries it.
   */
  async settleRefund(refundId: string): Promise<void> {
    try {
      const pending = await this.payments.pendingRefund(this.db, refundId);
      if (!pending) return;
      const paid = (await this.payments.forBooking(this.db, pending.booking_id)).find(
        (p) => p.id === pending.payment_id,
      );
      if (!paid?.provider_payment_id) return;
      const { refundId: providerRefundId } = await this.provider.refund({
        paymentId: paid.provider_payment_id,
        amountPaise: pending.amount_paise,
        idempotencyKey: pending.id,
      });
      await withTransaction(this.db, async (trx) => {
        await this.payments.markRefundProcessed(trx, pending.id, providerRefundId);
        await this.payments.markRefunded(trx, paid.id);
      });
    } catch (error) {
      this.log.warn(`Refund ${refundId} stays pending: ${(error as Error).message}`);
    }
  }

  /** Retries refunds that are still pending (background sweep). */
  async settlePendingRefunds(limit: number): Promise<number> {
    const pending = await this.payments.pendingRefunds(this.db, limit);
    for (const refund of pending) await this.settleRefund(refund.id);
    return pending.length;
  }

  // ── staff: hand over and take back (P2-26-lite) ─────────────────────────────────────────────────
  async pickup(actor: Actor, access: DrawerAccess, id: string): Promise<BookingDto> {
    await withTransaction(this.db, async (trx) => {
      const row = await this.scoped(trx, access, id);
      const from = row.status as BookingStatus;
      if (!canTransition(from, 'active')) {
        throw invalidState(`A ${from.replace('_', ' ')} booking cannot be picked up`);
      }
      const now = this.clock.now();
      const earliest = row.starts_at.getTime() - this.config.pickupEarlyMinutes * MINUTE_MS;
      if (now.getTime() < earliest) {
        throw invalidState('Too early: the booking has not started yet');
      }
      if (now.getTime() >= row.ends_at.getTime()) {
        throw invalidState('The booking time is over');
      }
      await this.bookings.setStatus(trx, id, 'active');
      await this.bookings.insertEvent(trx, {
        bookingId: id,
        from,
        to: 'active',
        actorId: actor.id,
        at: now,
      });
      await this.audit.record(trx, {
        actor,
        action: 'booking.picked_up',
        entityType: 'booking',
        entityId: id,
        before: { status: from },
        after: { status: 'active' },
      });
    });
    return this.service.present(this.db, id);
  }

  async returned(actor: Actor, access: DrawerAccess, id: string): Promise<BookingDto> {
    await withTransaction(this.db, async (trx) => {
      const row = await this.scoped(trx, access, id);
      const from = row.status as BookingStatus;
      if (!canTransition(from, 'completed')) {
        throw invalidState(`A ${from.replace('_', ' ')} booking cannot be returned`);
      }
      const now = this.clock.now();
      await this.bookings.setStatus(trx, id, 'completed');
      // Early return: the unit is bookable again right after the cleaning buffer (no refund — Q-6).
      if (now.getTime() < row.ends_at.getTime()) {
        await this.bookings.shrinkOccupancy(
          trx,
          id,
          new Date(now.getTime() + row.buffer_min * MINUTE_MS),
        );
      }
      await this.bookings.insertEvent(trx, {
        bookingId: id,
        from,
        to: 'completed',
        actorId: actor.id,
        at: now,
      });
      await this.bookings.insertOutbox(
        trx,
        'booking.completed',
        { bookingId: id, userId: row.user_id },
        now,
      );
      await this.audit.record(trx, {
        actor,
        action: 'booking.returned',
        entityType: 'booking',
        entityId: id,
        before: { status: from },
        after: { status: 'completed' },
      });
    });
    return this.service.present(this.db, id);
  }

  private async scoped(trx: Tx, access: DrawerAccess, id: string): Promise<BookingRow> {
    const row = await this.bookings.lock(trx, id);
    if (!row || !accessIncludes(access, row.drawer_id)) throw bookingNotFound();
    return row;
  }
}

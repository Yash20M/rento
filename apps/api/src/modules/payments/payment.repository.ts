import { Injectable } from '@nestjs/common';
import type { Kysely, Selectable } from 'kysely';
import type { Payments, Refunds } from '../../db/generated/database';
import type { Database } from '../../db/kysely';

type Db = Kysely<Database>;
export type PaymentRow = Selectable<Payments>;
export type RefundRow = Selectable<Refunds>;

@Injectable()
export class PaymentRepository {
  /** The booking's live payment (created or captured), if any. */
  async openForBooking(db: Db, bookingId: string): Promise<PaymentRow | undefined> {
    return db
      .selectFrom('payments')
      .selectAll()
      .where('booking_id', '=', bookingId)
      .where('extension_id', 'is', null)
      .where('status', 'in', ['created', 'captured'])
      .executeTakeFirst();
  }

  /** The (single) live payment of one extension. */
  async openForExtension(db: Db, extensionId: string): Promise<PaymentRow | undefined> {
    return db
      .selectFrom('payments')
      .selectAll()
      .where('extension_id', '=', extensionId)
      .where('status', 'in', ['created', 'captured'])
      .executeTakeFirst();
  }

  async openForBookings(db: Db, bookingIds: readonly string[]): Promise<PaymentRow[]> {
    if (bookingIds.length === 0) return [];
    return db
      .selectFrom('payments')
      .selectAll()
      .where('booking_id', 'in', bookingIds)
      .where('extension_id', 'is', null)
      .where('status', 'in', ['created', 'captured', 'refunded'])
      .execute();
  }

  async refundsFor(db: Db, bookingIds: readonly string[]): Promise<RefundRow[]> {
    if (bookingIds.length === 0) return [];
    return db.selectFrom('refunds').selectAll().where('booking_id', 'in', bookingIds).execute();
  }

  /** An unpaid order is closed when its booking is cancelled or expires. */
  async failUnpaid(db: Db, bookingId: string): Promise<void> {
    await db
      .updateTable('payments')
      .set({ status: 'failed' })
      .where('booking_id', '=', bookingId)
      .where('extension_id', 'is', null)
      .where('status', '=', 'created')
      .execute();
  }

  async forBooking(db: Db, bookingId: string): Promise<PaymentRow[]> {
    return db
      .selectFrom('payments')
      .selectAll()
      .where('booking_id', '=', bookingId)
      .orderBy('created_at')
      .execute();
  }

  async insert(
    db: Db,
    p: {
      bookingId: string;
      provider: string;
      orderId: string;
      amountPaise: number;
      extensionId?: string;
    },
  ): Promise<PaymentRow> {
    return db
      .insertInto('payments')
      .values({
        booking_id: p.bookingId,
        provider: p.provider,
        provider_order_id: p.orderId,
        amount_paise: p.amountPaise,
        extension_id: p.extensionId ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async markCaptured(db: Db, id: string, providerPaymentId: string): Promise<void> {
    await db
      .updateTable('payments')
      .set({ status: 'captured', provider_payment_id: providerPaymentId })
      .where('id', '=', id)
      .execute();
  }

  async markRefunded(db: Db, id: string): Promise<void> {
    await db.updateTable('payments').set({ status: 'refunded' }).where('id', '=', id).execute();
  }

  async refundFor(db: Db, bookingId: string): Promise<RefundRow | undefined> {
    return db
      .selectFrom('refunds')
      .selectAll()
      .where('booking_id', '=', bookingId)
      .executeTakeFirst();
  }

  /** At most one refund per booking (unique index): a second cancel can never refund twice. */
  async insertRefund(
    db: Db,
    r: { bookingId: string; paymentId: string; amountPaise: number; reason: string },
  ): Promise<RefundRow | undefined> {
    return db
      .insertInto('refunds')
      .values({
        booking_id: r.bookingId,
        payment_id: r.paymentId,
        amount_paise: r.amountPaise,
        reason: r.reason,
      })
      .onConflict((oc) => oc.column('booking_id').doNothing())
      .returningAll()
      .executeTakeFirst();
  }

  async markRefundProcessed(db: Db, id: string, providerRefundId: string): Promise<void> {
    await db
      .updateTable('refunds')
      .set({ status: 'processed', provider_refund_id: providerRefundId })
      .where('id', '=', id)
      .execute();
  }

  async pendingRefund(db: Db, id: string): Promise<RefundRow | undefined> {
    return db
      .selectFrom('refunds')
      .selectAll()
      .where('id', '=', id)
      .where('status', '=', 'pending')
      .executeTakeFirst();
  }

  async pendingRefunds(db: Db, limit: number): Promise<RefundRow[]> {
    return db
      .selectFrom('refunds')
      .selectAll()
      .where('status', '=', 'pending')
      .orderBy('created_at')
      .limit(limit)
      .execute();
  }
}

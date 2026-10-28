import { Inject, Injectable } from '@nestjs/common';
import { type Kysely, sql } from 'kysely';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import { AppError } from '../../../common/errors/app-error';
import { pgErrorCode } from '../../../db/errors';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { type Tx, withTransaction } from '../../../db/transaction';
import { DrawerRepository } from '../../drawers';
import { InventoryRepository, effectiveSlotPrice } from '../../inventory';
import {
  FakePaymentProvider,
  PAYMENT_PROVIDER,
  PaymentRepository,
  type PaymentProvider,
} from '../../payments';
import { BookingRepository, type BookingRow } from '../data/booking.repository';
import {
  MINUTE_MS,
  assertDrawerOpen,
  bookingField,
  bookingNotFound,
  invalidState,
  paymentInvalid,
  rentalPrice,
} from '../domain/booking-rules';
import type { BookingDto, ExtensionDto, SimulatedCheckoutDto } from '../http/bookings.dto';
import { BookingService } from './booking.service';

const unavailable = (maxMinutes: number): AppError =>
  new AppError({
    status: 409,
    code: 'EXTENSION_UNAVAILABLE',
    detail:
      maxMinutes > 0
        ? `The unit is booked after this rental. You can extend by at most ${maxMinutes} minutes`
        : 'The unit is booked right after this rental, so it cannot be extended',
    errors: [{ field: 'extraMinutes', message: `at most ${maxMinutes} minutes` }],
  });

/**
 * Extending a rental that is running (README §9.8). The extra time is paid by its own order; it is applied only when
 * that payment is verified, and the exclusion constraint (not this code) decides whether the unit is still free.
 */
@Injectable()
export class BookingExtensionService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly bookings: BookingRepository,
    private readonly payments: PaymentRepository,
    private readonly drawers: DrawerRepository,
    private readonly inventory: InventoryRepository,
    private readonly service: BookingService,
  ) {}

  /** Checks the extension is possible and creates the order to pay. Nothing is blocked yet. */
  async start(userId: string, id: string, extraMinutes: number): Promise<ExtensionDto> {
    return withTransaction(this.db, async (trx) => {
      const row = await this.owned(trx, userId, id);
      if (row.status !== 'active') {
        throw invalidState('Only a rental that is running can be extended');
      }
      const model = await this.inventory.findItemModel(trx, row.item_model_id);
      if (!model) throw bookingNotFound();
      if (
        !Number.isInteger(extraMinutes) ||
        extraMinutes <= 0 ||
        extraMinutes % model.slot_minutes !== 0
      ) {
        throw bookingField('extraMinutes', `must be a multiple of ${model.slot_minutes} minutes`);
      }
      const max = await this.maxExtensionMinutes(
        trx,
        row,
        model.slot_minutes,
        model.max_duration_min,
      );
      if (extraMinutes > max) throw unavailable(max);

      // An extension is bought at the offer that applies now, like a booking is.
      const slotPrice = effectiveSlotPrice(model, this.clock.now());
      const price = rentalPrice(extraMinutes, model.slot_minutes, slotPrice.pricePaise);
      const saved = rentalPrice(extraMinutes, model.slot_minutes, slotPrice.listPaise) - price;
      const extension = await trx
        .insertInto('booking_extensions')
        .values({
          booking_id: id,
          extra_minutes: extraMinutes,
          extra_price_paise: price,
          extra_discount_paise: saved,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      const { orderId } = await this.provider.createOrder({
        amountPaise: price,
        receipt: extension.id,
      });
      await this.payments.insert(trx, {
        bookingId: id,
        provider: this.provider.name,
        orderId,
        amountPaise: price,
        extensionId: extension.id,
      });
      return {
        id: extension.id,
        extraMinutes,
        pricePaise: price,
        newEndsAt: new Date(row.ends_at.getTime() + extraMinutes * MINUTE_MS).toISOString(),
        orderId,
        provider: this.provider.name,
      };
    });
  }

  async simulate(userId: string, id: string, extensionId: string): Promise<SimulatedCheckoutDto> {
    if (!(this.provider instanceof FakePaymentProvider)) throw bookingNotFound();
    await this.owned(this.db, userId, id);
    const payment = await this.payments.openForExtension(this.db, extensionId);
    if (!payment || payment.booking_id !== id || payment.status !== 'created') {
      throw invalidState('Start the extension first');
    }
    return this.provider.simulateCheckout(payment.provider_order_id);
  }

  async confirm(
    userId: string,
    id: string,
    extensionId: string,
    proof: { orderId: string; paymentId: string; signature: string },
  ): Promise<BookingDto> {
    await withTransaction(this.db, async (trx) => {
      const row = await this.owned(trx, userId, id, true);
      const extension = await trx
        .selectFrom('booking_extensions')
        .selectAll()
        .where('id', '=', extensionId)
        .where('booking_id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      const payment = extension
        ? await this.payments.openForExtension(trx, extensionId)
        : undefined;
      if (!extension || !payment || payment.provider_order_id !== proof.orderId)
        throw paymentInvalid();
      if (!this.provider.verifyPayment(proof)) throw paymentInvalid();
      if (extension.status === 'applied' && payment.provider_payment_id === proof.paymentId) return; // repeat
      if (extension.status !== 'pending') throw invalidState('This extension was already applied');
      if (row.status !== 'active')
        throw invalidState('Only a rental that is running can be extended');

      const newEnd = new Date(row.ends_at.getTime() + extension.extra_minutes * MINUTE_MS);
      const blockedUntil = new Date(newEnd.getTime() + row.buffer_min * MINUTE_MS);
      // The constraint also guards UPDATE: another booking or block in the way raises 23P01.
      await sql`SAVEPOINT extend`.execute(trx);
      try {
        await sql`
          UPDATE asset_occupancies
             SET during = tstzrange(lower(during), ${blockedUntil}::timestamptz, '[)')
           WHERE booking_id = ${id} AND released_at IS NULL`.execute(trx);
      } catch (error) {
        if (pgErrorCode(error) !== '23P01') throw error;
        await sql`ROLLBACK TO SAVEPOINT extend`.execute(trx);
        throw unavailable(await this.maxExtensionMinutes(trx, row, 1, Number.MAX_SAFE_INTEGER));
      }
      await sql`RELEASE SAVEPOINT extend`.execute(trx);

      const now = this.clock.now();
      await this.provider.capture({
        paymentId: proof.paymentId,
        amountPaise: payment.amount_paise,
      });
      await this.payments.markCaptured(trx, payment.id, proof.paymentId);
      await trx
        .updateTable('booking_extensions')
        .set({ status: 'applied', applied_at: now })
        .where('id', '=', extensionId)
        .execute();
      await trx
        .updateTable('bookings')
        .set({
          ends_at: newEnd,
          price_paise: sql`price_paise + ${extension.extra_price_paise}`,
          discount_paise: sql`discount_paise + ${extension.extra_discount_paise}`,
          version: sql`version + 1`,
        })
        .where('id', '=', id)
        .execute();
      await this.bookings.insertEvent(trx, {
        bookingId: id,
        from: 'active',
        to: 'active',
        actorId: userId,
        note: `Extended by ${extension.extra_minutes} minutes`,
        at: now,
      });
      await this.bookings.insertOutbox(
        trx,
        'booking.extended',
        { bookingId: id, userId, extraMinutes: extension.extra_minutes },
        now,
      );
    });
    return this.service.present(this.db, id);
  }

  /**
   * The longest extension (in whole slots) the unit and the opening hours allow: before the next booking or block
   * (keeping the cleaning buffer), before closing, and within the model's maximum rental length.
   */
  private async maxExtensionMinutes(
    db: Kysely<Database>,
    row: BookingRow,
    slotMinutes: number,
    maxDurationMin: number,
  ): Promise<number> {
    const blockedUntil = new Date(row.ends_at.getTime() + row.buffer_min * MINUTE_MS);
    const next = await sql<{ starts: Date | null }>`
      SELECT min(lower(o.during)) AS starts FROM asset_occupancies o
       WHERE o.asset_id = ${row.asset_id} AND o.released_at IS NULL
         AND o.booking_id IS DISTINCT FROM ${row.id}
         AND upper(o.during) > ${blockedUntil}::timestamptz`.execute(db);
    let limit = Number.POSITIVE_INFINITY;
    const nextStart = next.rows[0]?.starts;
    if (nextStart)
      limit =
        (nextStart.getTime() - row.buffer_min * MINUTE_MS - row.ends_at.getTime()) / MINUTE_MS;

    const drawer = await this.drawers.find(db, row.drawer_id);
    if (drawer) {
      // Walk forward slot by slot while the rental would still fit the opening hours of its day.
      const [hours, closures] = await Promise.all([
        this.drawers.hoursFor(db, [drawer.id]),
        this.drawers.closuresFor(db, [drawer.id], row.starts_at),
      ]);
      let fit = 0;
      for (let m = slotMinutes; m <= Math.min(limit, 24 * 60); m += slotMinutes) {
        try {
          assertDrawerOpen(
            { timezone: drawer.timezone, status: 'active' },
            hours,
            closures,
            row.starts_at,
            new Date(row.ends_at.getTime() + m * MINUTE_MS),
          );
          fit = m;
        } catch {
          break;
        }
      }
      limit = Math.min(limit, fit);
    }
    const already = (row.ends_at.getTime() - row.starts_at.getTime()) / MINUTE_MS;
    limit = Math.min(limit, maxDurationMin - already);
    return Math.max(0, Math.floor(limit / slotMinutes) * slotMinutes);
  }

  private async owned(
    db: Kysely<Database>,
    userId: string,
    id: string,
    lock = false,
  ): Promise<BookingRow> {
    const row = lock
      ? await this.bookings.lock(db as Tx, id)
      : await db.selectFrom('bookings').selectAll().where('id', '=', id).executeTakeFirst();
    if (!row || row.user_id !== userId) throw bookingNotFound();
    return row;
  }
}

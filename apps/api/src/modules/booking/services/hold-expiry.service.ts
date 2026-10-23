import { Injectable } from '@nestjs/common';
import type { Tx } from '../../../db/transaction';
import { BookingRepository } from '../data/booking.repository';

/**
 * Releases holds whose time ran out (README §9.4 step 4, §9.6). The unpaid order is kept: a payment that completes late can still be honoured if the slot
 * is free (§9.5). Used by the booking path and by the background sweep. */
@Injectable()
export class HoldExpiryService {
  constructor(private readonly bookings: BookingRepository) {}

  /** Returns how many holds were expired. Idempotent; rows locked by someone else are left for the next run. */
  async expire(
    trx: Tx,
    now: Date,
    limit: number,
    scope?: { drawerId: string; itemModelId: string },
  ): Promise<number> {
    const expired = await this.bookings.expireHolds(trx, now, limit, scope);
    for (const booking of expired) {
      await this.bookings.insertEvent(trx, {
        bookingId: booking.id,
        from: 'held',
        to: 'expired',
        actorId: null,
        note: 'The hold ran out before payment',
        at: now,
      });
      await this.bookings.insertOutbox(
        trx,
        'booking.expired',
        { bookingId: booking.id, userId: booking.user_id },
        now,
      );
    }
    return expired.length;
  }
}

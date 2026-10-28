import { Inject, Injectable } from '@nestjs/common';
import { type Kysely, sql } from 'kysely';
import { AppError } from '../../../common/errors/app-error';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import {
  IdempotencyService,
  type IdempotentResult,
} from '../../../common/idempotency/idempotency.service';
import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/config.module';
import { SlotTakenError, pgErrorCode } from '../../../db/errors';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import type { Tx } from '../../../db/transaction';
import { DrawerRepository } from '../../drawers';
import { InventoryRepository, effectiveSlotPrice } from '../../inventory';
import { KycService } from '../../kyc';
import { PaymentRepository } from '../../payments';
import { toBookingDto } from '../booking-view';
import { BookingRepository } from '../data/booking.repository';
import {
  MINUTE_MS,
  assertDrawerOpen,
  bookingField,
  bookingNotFound,
  rentalPrice,
  validateRequest,
} from '../domain/booking-rules';
import type { BookingDto } from '../http/bookings.dto';
import { HoldExpiryService } from './hold-expiry.service';

const MAX_CLAIM_ATTEMPTS = 3;
const LAZY_CLEANUP_LIMIT = 50;

export interface HoldRequest {
  drawerId: string;
  itemModelId: string;
  startsAt: string;
  durationMinutes: number;
}

/**
 * Customer-side booking: create a hold (README §9.4, ADR-015) and read your own bookings.
 * The exclusion constraint on `asset_occupancies` is the only guarantee against double booking; everything
 * else here (candidate choice, validation) gives good errors and reduces contention.
 */
@Injectable()
export class BookingService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly bookings: BookingRepository,
    private readonly drawers: DrawerRepository,
    private readonly inventory: InventoryRepository,
    private readonly payments: PaymentRepository,
    private readonly idempotency: IdempotencyService,
    private readonly holdExpiry: HoldExpiryService,
    private readonly kyc: KycService,
  ) {}

  createHold(
    userId: string,
    key: string,
    hash: string,
    request: HoldRequest,
  ): Promise<IdempotentResult> {
    return this.idempotency.run(userId, key, hash, async (trx) => ({
      status: 201,
      body: await this.claim(trx, userId, request),
    }));
  }

  private async claim(trx: Tx, userId: string, request: HoldRequest): Promise<BookingDto> {
    // Owner decision 2026-10-18: nobody books without a verified identity (Aadhaar).
    const account = await trx
      .selectFrom('users')
      .select('status')
      .where('id', '=', userId)
      .executeTakeFirst();
    if (account?.status !== 'active') {
      throw new AppError({
        status: 403,
        code: 'FORBIDDEN',
        detail: 'Your account is suspended. Please contact support',
      });
    }
    await this.kyc.assertCanBook(userId, trx);
    const now = this.clock.now();
    const startsAt = new Date(request.startsAt);
    if (startsAt.getTime() % MINUTE_MS !== 0) {
      throw bookingField('startsAt', 'must be on a whole minute');
    }

    // 1. What is being asked for must exist and be rentable at all (404 otherwise).
    const drawer = await this.drawers.find(trx, request.drawerId);
    const model = await this.inventory.findItemModel(trx, request.itemModelId);
    const offered = (await this.drawers.inventory(trx, request.drawerId, now)).some(
      (row) => row.item_model_id === request.itemModelId,
    );
    if (
      !drawer ||
      drawer.status === 'inactive' ||
      !model ||
      model.status !== 'active' ||
      !offered
    ) {
      throw bookingNotFound();
    }

    // 2. Business rules over the request, the local clock and the closures.
    validateRequest(
      { startsAt, durationMinutes: request.durationMinutes },
      {
        slotMinutes: model.slot_minutes,
        minDurationMin: model.min_duration_min,
        maxDurationMin: model.max_duration_min,
        minLeadMinutes: this.config.bookingMinLeadMinutes,
        maxAdvanceDays: this.config.bookingMaxAdvanceDays,
      },
      now,
    );
    const endsAt = new Date(startsAt.getTime() + request.durationMinutes * MINUTE_MS);
    const [hours, closures] = await Promise.all([
      this.drawers.hoursFor(trx, [drawer.id]),
      this.drawers.closuresFor(trx, [drawer.id], startsAt),
    ]);
    assertDrawerOpen(drawer, hours, closures, startsAt, endsAt);

    // 3. Holds that ran out must not block this window (the sweep does the same, but the booking never waits for it).
    await this.holdExpiry.expire(trx, now, LAZY_CLEANUP_LIMIT, {
      drawerId: drawer.id,
      itemModelId: model.id,
    });

    // 4. Claim a unit. The occupancy covers the buffer after the rental (README §9.2).
    const blockedUntil = new Date(endsAt.getTime() + model.buffer_min * MINUTE_MS);
    const holdExpiresAt = new Date(
      Math.min(now.getTime() + this.config.holdMinutes * MINUTE_MS, startsAt.getTime()),
    );
    // The price is fixed now, at the offer that applies at this moment, and kept on the booking (price charged + saving).
    const slotPrice = effectiveSlotPrice(model, now);
    const charged = rentalPrice(request.durationMinutes, model.slot_minutes, slotPrice.pricePaise);
    const rental = {
      charged,
      saved:
        rentalPrice(request.durationMinutes, model.slot_minutes, slotPrice.listPaise) - charged,
    };
    const tried: string[] = [];
    for (let attempt = 0; attempt < MAX_CLAIM_ATTEMPTS; attempt += 1) {
      const search = {
        drawerId: drawer.id,
        itemModelId: model.id,
        from: startsAt,
        to: blockedUntil,
        exclude: tried,
        now,
      };
      let assetId = await this.bookings.candidate(trx, { ...search, skipLocked: true });
      // ADR-015: every free-looking unit is locked by someone else's in-flight claim → wait for the truth
      // instead of answering a false conflict. Only while this transaction holds no other asset lock.
      if (assetId === undefined && tried.length === 0) {
        assetId = await this.bookings.candidate(trx, { ...search, skipLocked: false });
      }
      if (assetId === undefined) break;
      tried.push(assetId);

      await sql`SAVEPOINT claim`.execute(trx);
      try {
        const booking = await this.bookings.insert(trx, {
          userId,
          assetId,
          drawerId: drawer.id,
          itemModelId: model.id,
          startsAt,
          endsAt,
          bufferMin: model.buffer_min,
          holdExpiresAt,
          pricePaise: rental.charged,
          discountPaise: rental.saved,
          depositPaise: model.deposit_paise,
        });
        await this.bookings.insertOccupancy(trx, booking.id, assetId, startsAt, blockedUntil);
        await sql`RELEASE SAVEPOINT claim`.execute(trx);

        await this.bookings.insertEvent(trx, {
          bookingId: booking.id,
          from: null,
          to: 'held',
          actorId: userId,
          at: now,
        });
        await this.bookings.insertOutbox(
          trx,
          'booking.held',
          { bookingId: booking.id, userId, holdExpiresAt: holdExpiresAt.toISOString() },
          now,
        );
        return this.present(trx, booking.id);
      } catch (error) {
        if (pgErrorCode(error) !== '23P01') throw error;
        // Lost the race for this unit: undo the booking row too and try the next one.
        await sql`ROLLBACK TO SAVEPOINT claim`.execute(trx);
      }
    }
    throw new SlotTakenError();
  }

  async list(userId: string, status: string | undefined): Promise<BookingDto[]> {
    const rows = await this.bookings.listForUser(this.db, userId, status);
    const ids = rows.map((r) => r.id);
    const [payments, refunds] = await Promise.all([
      this.payments.openForBookings(this.db, ids),
      this.payments.refundsFor(this.db, ids),
    ]);
    return rows.map((row) =>
      toBookingDto(
        row,
        payments.find((p) => p.booking_id === row.id),
        refunds.find((r) => r.booking_id === row.id),
      ),
    );
  }

  /** Somebody else's booking is indistinguishable from one that does not exist. */
  async get(userId: string, id: string): Promise<BookingDto> {
    const row = await this.bookings.view(this.db, id);
    if (!row || row.user_id !== userId) throw bookingNotFound();
    return this.present(this.db, id);
  }

  async present(db: Kysely<Database>, id: string): Promise<BookingDto> {
    const view = await this.bookings.view(db, id);
    if (!view) throw bookingNotFound();
    const [payments, refunds] = await Promise.all([
      this.payments.openForBookings(db, [id]),
      this.payments.refundsFor(db, [id]),
    ]);
    return toBookingDto(view, payments[0], refunds[0]);
  }
}

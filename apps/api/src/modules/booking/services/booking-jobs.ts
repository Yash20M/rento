import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { type Kysely, sql } from 'kysely';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import { IdempotencyService } from '../../../common/idempotency/idempotency.service';
import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/config.module';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { withTransaction } from '../../../db/transaction';
import { BookingRepository } from '../data/booking.repository';
import { BookingLifecycleService } from './booking-lifecycle.service';
import { HoldExpiryService } from './hold-expiry.service';
import { OutboxDispatcher } from './outbox-dispatcher';

const BATCH = 100;
const MAX_BATCHES = 10;

export interface JobsReport {
  expiredHolds: number;
  overdue: number;
  noShows: number;
  remindersQueued: number;
  refundsRetried: number;
  outboxDelivered: number;
  idempotencyPurged: number;
}

/**
 * The background sweeps (README §9.6): expire holds, mark overdue rentals and no-shows, retry refunds, deliver the
 * outbox, clean old idempotency keys. Each step is idempotent and uses `SKIP LOCKED`, so running it on several API
 * instances at once is safe. Tests call `runOnce()` directly with a fake clock.
 */
@Injectable()
export class BookingJobs implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(BookingJobs.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly bookings: BookingRepository,
    private readonly holdExpiry: HoldExpiryService,
    private readonly lifecycle: BookingLifecycleService,
    private readonly outbox: OutboxDispatcher,
    private readonly idempotency: IdempotencyService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.jobsIntervalSeconds <= 0) return;
    this.timer = setInterval(() => void this.tick(), this.config.jobsIntervalSeconds * 1000);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return; // a slow run must not overlap the next one
    this.running = true;
    try {
      await this.runOnce();
    } catch (error) {
      this.log.error(`Background sweep failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  async runOnce(): Promise<JobsReport> {
    const report: JobsReport = {
      expiredHolds: 0,
      overdue: 0,
      noShows: 0,
      remindersQueued: 0,
      refundsRetried: 0,
      outboxDelivered: 0,
      idempotencyPurged: 0,
    };

    for (let i = 0; i < MAX_BATCHES; i += 1) {
      const n = await withTransaction(this.db, (trx) =>
        this.holdExpiry.expire(trx, this.clock.now(), BATCH),
      );
      report.expiredHolds += n;
      if (n < BATCH) break;
    }

    report.overdue = await withTransaction(this.db, async (trx) => {
      const now = this.clock.now();
      const ids = await this.bookings.markOverdue(trx, now, BATCH);
      for (const id of ids) {
        await this.bookings.insertEvent(trx, {
          bookingId: id,
          from: 'active',
          to: 'overdue',
          actorId: null,
          note: 'Not returned by the end time',
          at: now,
        });
        await this.bookings.insertOutbox(trx, 'booking.overdue', { bookingId: id }, now);
      }
      return ids.length;
    });

    report.noShows = await withTransaction(this.db, async (trx) => {
      const now = this.clock.now();
      const ids = await this.bookings.markNoShow(trx, now, this.config.noShowGraceMinutes, BATCH);
      for (const id of ids) {
        await this.bookings.insertEvent(trx, {
          bookingId: id,
          from: 'confirmed',
          to: 'no_show',
          actorId: null,
          note: 'Not collected within the grace period',
          at: now,
        });
        await this.bookings.insertOutbox(trx, 'booking.no_show', { bookingId: id }, now);
      }
      return ids.length;
    });

    if (this.config.reminderMinutes > 0) {
      report.remindersQueued = await withTransaction(this.db, async (trx) => {
        const now = this.clock.now();
        const due = await sql<{ id: string }>`
          UPDATE bookings SET reminder_sent_at = ${now}
           WHERE id IN (
             SELECT id FROM bookings
              WHERE status = 'confirmed' AND reminder_sent_at IS NULL
                AND starts_at > ${now}
                AND starts_at <= ${new Date(now.getTime() + this.config.reminderMinutes * 60_000)}
              ORDER BY starts_at LIMIT ${BATCH}
                FOR UPDATE SKIP LOCKED)
          RETURNING id`.execute(trx);
        for (const row of due.rows) {
          await this.bookings.insertOutbox(trx, 'booking.reminder', { bookingId: row.id }, now);
        }
        return due.rows.length;
      });
    }

    report.refundsRetried = await this.lifecycle.settlePendingRefunds(50);
    report.outboxDelivered = await this.outbox.dispatch(BATCH);
    report.idempotencyPurged = await this.idempotency.purgeExpired();
    return report;
  }
}

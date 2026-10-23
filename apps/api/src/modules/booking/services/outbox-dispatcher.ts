import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { withTransaction } from '../../../db/transaction';
import { BookingRepository } from '../data/booking.repository';

export type OutboxHandler = (event: {
  id: string;
  type: string;
  payload: unknown;
}) => Promise<void>;

const RETRY_BASE_MS = 30_000;
const RETRY_MAX_MS = 3_600_000;

/**
 * Delivers the transactional outbox (README §12.3): events were written in the same transaction as the change they
 * describe, so none is lost. Handlers (notifications — P2-30) register by event type; an event with no handler is simply
 * marked delivered. Failed deliveries are retried with backoff. Delivery is at-least-once: handlers must be idempotent.
 */
@Injectable()
export class OutboxDispatcher {
  private readonly log = new Logger(OutboxDispatcher.name);
  private readonly handlers = new Map<string, OutboxHandler[]>();

  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly bookings: BookingRepository,
  ) {}

  register(type: string, handler: OutboxHandler): void {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
  }

  /** Delivers up to `limit` due events; returns how many were delivered. */
  async dispatch(limit: number): Promise<number> {
    return withTransaction(this.db, async (trx) => {
      const now = this.clock.now();
      const due = await this.bookings.claimOutbox(trx, now, limit);
      let delivered = 0;
      for (const event of due) {
        try {
          for (const handler of this.handlers.get(event.type) ?? []) await handler(event);
          await this.bookings.markOutboxDone(trx, event.id, now);
          delivered += 1;
        } catch (error) {
          const delay = Math.min(RETRY_BASE_MS * 2 ** event.attempts, RETRY_MAX_MS);
          this.log.warn(
            `Outbox event ${event.id} (${event.type}) failed: ${(error as Error).message}`,
          );
          await this.bookings.markOutboxFailed(
            trx,
            event.id,
            (error as Error).message,
            new Date(now.getTime() + delay),
          );
        }
      }
      return delivered;
    });
  }
}

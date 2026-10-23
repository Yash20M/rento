import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { AppError } from '../../../common/errors/app-error';
import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/config.module';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { withTransaction } from '../../../db/transaction';
import { verifyRazorpayWebhook } from '../../payments';
import { BookingPaymentService } from './booking-payment.service';

interface RazorpayEvent {
  id?: unknown;
  event?: unknown;
  payload?: { payment?: { entity?: { id?: unknown; order_id?: unknown } } };
}

const refused = (detail: string): AppError =>
  new AppError({ status: 401, code: 'UNAUTHENTICATED', detail });

/**
 * Razorpay webhooks (README §9.5). They are the safety net for a customer who paid but whose app never got to call
 * "confirm" (connection lost, app killed): the gateway tells us instead. Delivery is at least once, so each event id is
 * processed once; the signature is checked on the raw bytes before anything is parsed or trusted.
 *
 * Only `payment.authorized` changes state — orders are created with manual capture, so that event means "the customer
 * paid, nothing is captured yet". `payment.captured`, `order.paid`, `payment.failed`, `refund.*` are recorded and
 * ignored: capture and refunds are driven by this API, whose own calls already write the result.
 */
@Injectable()
export class PaymentWebhookService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly payments: BookingPaymentService,
  ) {}

  async razorpay(rawBody: Buffer | undefined, signature: string | undefined): Promise<void> {
    const secret = this.config.razorpayWebhookSecret;
    // Not configured (fake gateway): there is nothing to verify against, so refuse rather than guess.
    if (!secret || !rawBody || !signature || !verifyRazorpayWebhook(rawBody, signature, secret)) {
      throw refused('Invalid webhook signature');
    }
    let event: RazorpayEvent;
    try {
      event = JSON.parse(rawBody.toString('utf8')) as RazorpayEvent;
    } catch {
      throw refused('Invalid webhook body');
    }
    const eventId = typeof event.id === 'string' ? event.id : undefined;
    const type = typeof event.event === 'string' ? event.event : 'unknown';
    if (!eventId) throw refused('Invalid webhook body');

    await withTransaction(this.db, async (trx) => {
      const first = await trx
        .insertInto('webhook_events')
        .values({ provider: 'razorpay', event_id: eventId, event_type: type })
        .onConflict((oc) => oc.columns(['provider', 'event_id']).doNothing())
        .returning('event_id')
        .executeTakeFirst();
      if (!first) return; // a redelivery

      let outcome: 'applied' | 'ignored' = 'ignored';
      let note: string | null = null;
      const entity = event.payload?.payment?.entity;
      if (
        type === 'payment.authorized' &&
        typeof entity?.id === 'string' &&
        typeof entity.order_id === 'string'
      ) {
        note = await this.payments.confirmFromGateway(trx, entity.order_id, entity.id);
        if (note === 'applied') outcome = 'applied';
      }
      await trx
        .updateTable('webhook_events')
        .set({ outcome, note })
        .where('provider', '=', 'razorpay')
        .where('event_id', '=', eventId)
        .execute();
    });
  }
}

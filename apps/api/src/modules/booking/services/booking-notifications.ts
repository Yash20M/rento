import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { sql, type Kysely } from 'kysely';
import { MAIL_SENDER, type MailMessage, type MailSender } from '../../../common/mail/mail-sender';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { OutboxDispatcher } from './outbox-dispatcher';

interface Row {
  email: string | null;
  name: string | null;
  item: string;
  drawer: string;
  address: string;
  timezone: string;
  starts_at: Date;
  ends_at: Date;
  total_paise: number;
  refund_paise: number | null;
}

const rupees = (paise: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
  }).format(paise / 100);

const when = (row: Row): string => {
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-IN', { timeZone: row.timezone, ...opts }).format(d);
  return `${fmt(row.starts_at, { dateStyle: 'full', timeStyle: 'short' })} – ${fmt(row.ends_at, { timeStyle: 'short' })} (${row.timezone})`;
};

const escape = (text: string): string => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Customer emails for booking events, delivered from the transactional outbox (README §12.3): a failing mail server
 * is retried with backoff and never affects the booking itself. Customers without an email address get nothing.
 */
@Injectable()
export class BookingNotifications implements OnModuleInit {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
    private readonly outbox: OutboxDispatcher,
  ) {}

  onModuleInit(): void {
    this.outbox.register('booking.confirmed', (e) => this.send(e.payload, 'booking_confirmed'));
    this.outbox.register('booking.cancelled', (e) => this.send(e.payload, 'booking_cancelled'));
    this.outbox.register('booking.reminder', (e) => this.send(e.payload, 'booking_reminder'));
    this.outbox.register('booking.expired', (e) => this.send(e.payload, 'booking_expired'));
  }

  private async send(payload: unknown, purpose: MailMessage['purpose']): Promise<void> {
    const bookingId = (payload as { bookingId?: string }).bookingId;
    if (!bookingId) return;
    const result = await sql<Row>`
      SELECT u.email::text AS email, u.display_name AS name, m.name AS item, d.name AS drawer,
             d.address, d.timezone, b.starts_at, b.ends_at, b.price_paise + b.deposit_paise AS total_paise,
             (SELECT r.amount_paise FROM refunds r WHERE r.booking_id = b.id) AS refund_paise
        FROM bookings b JOIN users u ON u.id = b.user_id JOIN item_models m ON m.id = b.item_model_id
        JOIN drawers d ON d.id = b.drawer_id WHERE b.id = ${bookingId}`.execute(this.db);
    const row = result.rows[0];
    if (!row?.email) return;

    const hello = row.name ? `Hi ${row.name},` : 'Hi,';
    const details = `${row.item} at ${row.drawer}, ${row.address}\n${when(row)}`;
    const copy: Record<string, { subject: string; lines: string[] }> = {
      booking_confirmed: {
        subject: `Booked: ${row.item} — ${rupees(row.total_paise)} paid`,
        lines: [
          `You are booked.`,
          details,
          `Paid ${rupees(row.total_paise)} (rental plus a refundable deposit).`,
        ],
      },
      booking_cancelled: {
        subject: `Cancelled: ${row.item}`,
        lines: [
          `Your booking was cancelled.`,
          details,
          row.refund_paise
            ? `Refund: ${rupees(row.refund_paise)}.`
            : `No payment was taken, so there is nothing to refund.`,
        ],
      },
      booking_reminder: {
        subject: `Reminder: ${row.item} starts soon`,
        lines: [
          `Your rental starts soon. Bring a photo ID.`,
          details,
          `Cancelling now may refund less; see the cancellation policy in the app.`,
        ],
      },
      booking_expired: {
        subject: `Your hold on ${row.item} ran out`,
        lines: [
          `The slot was released because the payment did not arrive in time.`,
          details,
          `You were not charged. You can book again any time.`,
        ],
      },
    };
    const { subject, lines } = copy[purpose] ?? { subject: '', lines: [] };
    const text = [hello, '', ...lines].join('\n');
    await this.mail.send({
      to: row.email,
      subject,
      text,
      html: `<p>${escape(hello)}</p>${lines.map((l) => `<p>${escape(l).replace(/\n/g, '<br>')}</p>`).join('')}`,
      purpose,
    });
  }
}

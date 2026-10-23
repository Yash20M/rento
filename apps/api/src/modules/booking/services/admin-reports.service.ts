import { Inject, Injectable } from '@nestjs/common';
import { type Kysely, sql } from 'kysely';
import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/config.module';
import type { Database } from '../../../db/kysely';
import { DiscoverySettings } from '../../drawers';
import { KYSELY } from '../../../db/tokens';
import { type DrawerAccess, accessIncludes } from '../../access-control';
import { decodeCursor, encodeCursor } from '../data/booking.repository';
import { bookingField } from '../domain/booking-rules';
import type {
  PaymentLedgerPageDto,
  PaymentsQuery,
  ReportDto,
  ReportQuery,
  SettingsDto,
} from '../http/admin-ops.dto';

const DAY_MS = 86_400_000;
const MAX_REPORT_DAYS = 366;
const DEFAULT_LIMIT = 25;

const num = (value: string | number | null | undefined): number => Number(value ?? 0);
const oneDecimal = (value: number): number => Math.round(value * 10) / 10;

interface GroupRow {
  id: string;
  name: string;
  bookings: string;
  hours: string;
  collected: string;
}

/** Read models for the admin Reports, Payments and Settings screens (README §6.3, §13.1). */
@Injectable()
export class AdminReportsService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly discovery: DiscoverySettings,
  ) {}

  /**
   * Bookings CONFIRMED in the window (a booking counts once, on the day it was paid for, in its drawer's time zone).
   * Money is the cash view: everything taken for those bookings (rental, deposit, extensions) minus what was or will be
   * refunded. Deposits are refundable, so "collected" is not revenue — the screen says so.
   */
  async report(access: DrawerAccess, query: ReportQuery): Promise<ReportDto> {
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (Number.isNaN(from.getTime())) throw bookingField('from', 'is not a valid time');
    if (Number.isNaN(to.getTime())) throw bookingField('to', 'is not a valid time');
    if (to.getTime() <= from.getTime()) throw bookingField('to', 'must be after the start');
    if (to.getTime() - from.getTime() > MAX_REPORT_DAYS * DAY_MS) {
      throw bookingField('to', `cannot be more than ${MAX_REPORT_DAYS} days after the start`);
    }
    const empty: ReportDto = {
      totals: {
        bookings: 0,
        completed: 0,
        cancelled: 0,
        noShow: 0,
        rentedHours: 0,
        collectedPaise: 0,
        refundedPaise: 0,
        netPaise: 0,
      },
      days: [],
      drawers: [],
      models: [],
    };
    if (access.kind === 'none') return empty;
    if (query.drawerId !== undefined && !accessIncludes(access, query.drawerId)) return empty;

    const scope =
      access.kind === 'all' ? sql`true` : sql`b.drawer_id = ANY(${sql.val(access.ids)}::uuid[])`;
    const drawerFilter = query.drawerId ? sql`AND b.drawer_id = ${query.drawerId}` : sql``;
    const base = sql`
      WITH conf AS (
        SELECT b.id, b.drawer_id, b.item_model_id, b.status, b.starts_at, b.ends_at, d.timezone,
               d.name AS drawer_name, m.name AS model_name, min(e.at) AS confirmed_at
          FROM bookings b
          JOIN booking_events e ON e.booking_id = b.id AND e.to_status = 'confirmed'
          JOIN drawers d ON d.id = b.drawer_id
          JOIN item_models m ON m.id = b.item_model_id
         WHERE ${scope} ${drawerFilter}
         GROUP BY b.id, d.timezone, d.name, m.name
        HAVING min(e.at) >= ${from} AND min(e.at) < ${to}),
      paid AS (
        SELECT booking_id, sum(amount_paise) AS collected FROM payments
         WHERE status IN ('captured', 'refunded') GROUP BY booking_id),
      back AS (
        SELECT booking_id, sum(amount_paise) AS refunded FROM refunds
         WHERE status IN ('processed', 'pending') GROUP BY booking_id),
      x AS (
        SELECT c.*, COALESCE(paid.collected, 0) AS collected, COALESCE(back.refunded, 0) AS refunded,
               CASE WHEN c.status IN ('confirmed', 'active', 'overdue', 'completed')
                    THEN extract(epoch FROM c.ends_at - c.starts_at) / 3600.0 ELSE 0 END AS hours
          FROM conf c LEFT JOIN paid ON paid.booking_id = c.id LEFT JOIN back ON back.booking_id = c.id)`;

    const [totals, days, drawers, models] = await Promise.all([
      sql<Record<string, string | null>>`${base}
        SELECT count(*) AS bookings,
               count(*) FILTER (WHERE status = 'completed') AS completed,
               count(*) FILTER (WHERE status = 'cancelled') AS cancelled,
               count(*) FILTER (WHERE status = 'no_show') AS no_show,
               sum(hours) AS hours, sum(collected) AS collected, sum(refunded) AS refunded
          FROM x`.execute(this.db),
      sql<{ day: string; bookings: string; collected: string }>`${base}
        SELECT to_char((confirmed_at AT TIME ZONE timezone)::date, 'YYYY-MM-DD') AS day,
               count(*) AS bookings, sum(collected) AS collected
          FROM x GROUP BY 1 ORDER BY 1`.execute(this.db),
      sql<GroupRow>`${base}
        SELECT drawer_id AS id, drawer_name AS name, count(*) AS bookings, sum(hours) AS hours,
               sum(collected) AS collected
          FROM x GROUP BY drawer_id, drawer_name ORDER BY sum(collected) DESC, drawer_name`.execute(
        this.db,
      ),
      sql<GroupRow>`${base}
        SELECT item_model_id AS id, model_name AS name, count(*) AS bookings, sum(hours) AS hours,
               sum(collected) AS collected
          FROM x GROUP BY item_model_id, model_name ORDER BY sum(collected) DESC, model_name`.execute(
        this.db,
      ),
    ]);

    const t = totals.rows[0] ?? {};
    const collected = num(t['collected']);
    const refunded = num(t['refunded']);
    const row = (r: GroupRow) => ({
      id: r.id,
      name: r.name,
      bookings: num(r.bookings),
      rentedHours: oneDecimal(num(r.hours)),
      collectedPaise: num(r.collected),
    });
    return {
      totals: {
        bookings: num(t['bookings']),
        completed: num(t['completed']),
        cancelled: num(t['cancelled']),
        noShow: num(t['no_show']),
        rentedHours: oneDecimal(num(t['hours'])),
        collectedPaise: collected,
        refundedPaise: refunded,
        netPaise: collected - refunded,
      },
      days: days.rows.map((r) => ({
        day: r.day,
        bookings: num(r.bookings),
        collectedPaise: num(r.collected),
      })),
      drawers: drawers.rows.map(row),
      models: models.rows.map(row),
    };
  }

  async payments(access: DrawerAccess, query: PaymentsQuery): Promise<PaymentLedgerPageDto> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const cursor = query.cursor === undefined ? undefined : decodeCursor(query.cursor);
    if (query.cursor !== undefined && !cursor) throw bookingField('cursor', 'is not valid');
    if (access.kind === 'none' || (query.drawerId && !accessIncludes(access, query.drawerId))) {
      return { items: [], nextCursor: null };
    }
    const result = await sql<{
      id: string;
      booking_id: string;
      customer: string | null;
      drawer_name: string;
      provider: string;
      status: string;
      amount_paise: number;
      extension_id: string | null;
      refunded: number | null;
      refund_status: string | null;
      created_at: Date;
    }>`
      SELECT p.id, p.booking_id, COALESCE(u.display_name, u.email::text) AS customer, d.name AS drawer_name,
             p.provider, p.status, p.amount_paise, p.extension_id, r.amount_paise AS refunded,
             r.status AS refund_status, p.created_at
        FROM payments p
        JOIN bookings b ON b.id = p.booking_id
        JOIN drawers d ON d.id = b.drawer_id
        JOIN users u ON u.id = b.user_id
        LEFT JOIN refunds r ON r.payment_id = p.id
       WHERE ${
         access.kind === 'all' ? sql`true` : sql`b.drawer_id = ANY(${sql.val(access.ids)}::uuid[])`
       }
         ${query.status ? sql`AND p.status = ${query.status}` : sql``}
         ${query.drawerId ? sql`AND b.drawer_id = ${query.drawerId}` : sql``}
         ${
           cursor
             ? sql`AND (p.created_at, p.id) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`
             : sql``
         }
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT ${limit + 1}`.execute(this.db);
    const page = result.rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: page.map((r) => ({
        id: r.id,
        bookingId: r.booking_id,
        customer: r.customer,
        drawerName: r.drawer_name,
        provider: r.provider,
        status: r.status,
        amountPaise: r.amount_paise,
        extension: r.extension_id !== null,
        refundedPaise: r.refunded,
        refundStatus: r.refund_status,
        createdAt: r.created_at.toISOString(),
      })),
      nextCursor:
        result.rows.length > limit && last
          ? encodeCursor({ createdAt: last.created_at.toISOString(), id: last.id })
          : null,
    };
  }

  /** The rules the platform runs with right now. They come from the environment, so changing one is a deployment. */
  async settings(): Promise<SettingsDto> {
    const c = this.config;
    const discovery = await this.discovery.current();
    return {
      holdMinutes: c.holdMinutes,
      bookingMinLeadMinutes: c.bookingMinLeadMinutes,
      bookingMaxAdvanceDays: c.bookingMaxAdvanceDays,
      refundTiers: c.refundTiers.map((t) => ({
        minutesBeforeStart: t.minutesBeforeStart,
        percent: t.percent,
      })),
      pickupEarlyMinutes: c.pickupEarlyMinutes,
      noShowGraceMinutes: c.noShowGraceMinutes,
      discoveryRadiusMeters: discovery.radiusMeters,
      discoveryMaxResults: discovery.maxResults,
      kycRequired: c.kycRequired,
      paymentProvider: c.paymentProvider,
      paymentDemoMode: c.paymentProvider === 'fake',
      webhookConfigured: c.razorpayWebhookSecret !== undefined,
      jobsIntervalSeconds: c.jobsIntervalSeconds,
    };
  }
}

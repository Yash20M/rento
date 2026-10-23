import { Inject, Injectable } from '@nestjs/common';
import { type Kysely, sql } from 'kysely';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { type DrawerAccess } from '../../access-control';
import { toAdminBookingDto } from '../booking-view';
import { BookingRepository } from '../data/booking.repository';
import { PaymentRepository } from '../../payments';
import type { DashboardDto } from '../http/dashboard.dto';

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 7;
const UPCOMING = 5;

/** The numbers on the admin dashboard, limited to the drawers the administrator may see (README §13.5). */
@Injectable()
export class AdminDashboardService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly bookings: BookingRepository,
    private readonly payments: PaymentRepository,
  ) {}

  async summary(access: DrawerAccess): Promise<DashboardDto> {
    const now = this.clock.now();
    const since = new Date(now.getTime() - WINDOW_DAYS * DAY_MS);
    const empty: DashboardDto = {
      generatedAt: now.toISOString(),
      windowDays: WINDOW_DAYS,
      now: { held: 0, confirmed: 0, active: 0, overdue: 0 },
      lastDays: {
        completed: 0,
        cancelled: 0,
        noShow: 0,
        expired: 0,
        grossPaise: 0,
        refundedPaise: 0,
      },
      upcoming: [],
    };
    if (access.kind === 'none') return empty;
    const scope =
      access.kind === 'all' ? sql`true` : sql`b.drawer_id = ANY(${sql.val(access.ids)}::uuid[])`;

    // Live counts come from the bookings; "last days" come from the history, which carries the injected clock.
    const liveRows = await sql<{ status: string; n: string }>`
      SELECT b.status, count(*) AS n FROM bookings b
       WHERE ${scope} AND b.status IN ('held','confirmed','active','overdue')
       GROUP BY b.status`.execute(this.db);
    const live = (status: string) => Number(liveRows.rows.find((r) => r.status === status)?.n ?? 0);

    const recentRows = await sql<{ to_status: string; n: string }>`
      SELECT e.to_status, count(DISTINCT e.booking_id) AS n
        FROM booking_events e JOIN bookings b ON b.id = e.booking_id
       WHERE ${scope} AND e.at >= ${since} AND e.to_status IN ('completed','cancelled','no_show','expired')
       GROUP BY e.to_status`.execute(this.db);
    const recent = (status: string) =>
      Number(recentRows.rows.find((r) => r.to_status === status)?.n ?? 0);

    const money = await sql<{ gross: string | null; refunded: string | null }>`
      SELECT (SELECT sum(p.amount_paise)
                FROM payments p JOIN bookings b ON b.id = p.booking_id
               WHERE ${scope} AND p.status IN ('captured','refunded')
                 AND EXISTS (SELECT 1 FROM booking_events e
                              WHERE e.booking_id = b.id AND e.to_status = 'confirmed' AND e.at >= ${since})) AS gross,
             (SELECT sum(r.amount_paise)
                FROM refunds r JOIN bookings b ON b.id = r.booking_id
               WHERE ${scope} AND r.status = 'processed'
                 AND EXISTS (SELECT 1 FROM booking_events e
                              WHERE e.booking_id = b.id AND e.to_status = 'cancelled' AND e.at >= ${since})) AS refunded`.execute(
      this.db,
    );

    const upcomingIds = await sql<{ id: string }>`
      SELECT b.id FROM bookings b
       WHERE ${scope} AND b.status = 'confirmed' AND b.ends_at > ${now}
       ORDER BY b.starts_at, b.id
       LIMIT ${UPCOMING}`.execute(this.db);
    const upcoming = [];
    for (const { id } of upcomingIds.rows) {
      const view = await this.bookings.view(this.db, id);
      if (!view) continue;
      const [payment] = await this.payments.openForBookings(this.db, [id]);
      const [refund] = await this.payments.refundsFor(this.db, [id]);
      upcoming.push(toAdminBookingDto(view, payment, refund));
    }

    return {
      generatedAt: now.toISOString(),
      windowDays: WINDOW_DAYS,
      now: {
        held: live('held'),
        confirmed: live('confirmed'),
        active: live('active'),
        overdue: live('overdue'),
      },
      lastDays: {
        completed: recent('completed'),
        cancelled: recent('cancelled'),
        noShow: recent('no_show'),
        expired: recent('expired'),
        grossPaise: Number(money.rows[0]?.gross ?? 0),
        refundedPaise: Number(money.rows[0]?.refunded ?? 0),
      },
      upcoming,
    };
  }
}

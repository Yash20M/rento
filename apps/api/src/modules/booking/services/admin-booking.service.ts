import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { type DrawerAccess, accessIncludes } from '../../access-control';
import { PaymentRepository } from '../../payments';
import { toAdminBookingDto } from '../booking-view';
import { BookingRepository, decodeCursor, encodeCursor } from '../data/booking.repository';
import { bookingField, bookingNotFound } from '../domain/booking-rules';
import type {
  AdminBookingDetailDto,
  AdminBookingDto,
  AdminBookingPageDto,
  AdminBookingsQuery,
} from '../http/bookings.dto';

const DEFAULT_LIMIT = 25;

/** Staff-side reads of bookings, limited to the drawers the administrator may see (README §13.5). */
@Injectable()
export class AdminBookingService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    private readonly bookings: BookingRepository,
    private readonly payments: PaymentRepository,
  ) {}

  async list(access: DrawerAccess, query: AdminBookingsQuery): Promise<AdminBookingPageDto> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const cursor = query.cursor === undefined ? undefined : decodeCursor(query.cursor);
    if (query.cursor !== undefined && !cursor) throw bookingField('cursor', 'is not valid');
    if (query.drawerId !== undefined && !accessIncludes(access, query.drawerId)) {
      return { items: [], nextCursor: null };
    }

    const rows = await this.bookings.adminList(
      this.db,
      {
        drawerIds: access.kind === 'all' ? 'all' : access.kind === 'drawers' ? access.ids : [],
        status: query.status,
        drawerId: query.drawerId,
        from: query.from === undefined ? undefined : new Date(query.from),
        to: query.to === undefined ? undefined : new Date(query.to),
        q: query.q,
      },
      limit + 1,
      cursor,
    );
    const page = rows.slice(0, limit);
    const ids = page.map((r) => r.id);
    const [payments, refunds] = await Promise.all([
      this.payments.openForBookings(this.db, ids),
      this.payments.refundsFor(this.db, ids),
    ]);
    const last = page[page.length - 1];
    return {
      items: page.map((row) =>
        toAdminBookingDto(
          row,
          payments.find((p) => p.booking_id === row.id),
          refunds.find((r) => r.booking_id === row.id),
        ),
      ),
      nextCursor:
        rows.length > limit && last
          ? encodeCursor({ createdAt: last.created_at.toISOString(), id: last.id })
          : null,
    };
  }

  async get(access: DrawerAccess, id: string): Promise<AdminBookingDetailDto> {
    const row = await this.bookings.view(this.db, id);
    if (!row || !accessIncludes(access, row.drawer_id)) throw bookingNotFound();
    const [payments, refunds, events] = await Promise.all([
      this.payments.openForBookings(this.db, [id]),
      this.payments.refundsFor(this.db, [id]),
      this.bookings.events(this.db, id),
    ]);
    const base: AdminBookingDto = toAdminBookingDto(row, payments[0], refunds[0]);
    return {
      ...base,
      history: events.map((e) => ({
        from: e.from_status,
        to: e.to_status,
        actorUserId: e.actor_user_id,
        note: e.note,
        at: e.at.toISOString(),
      })),
    };
  }
}

import { AppError } from '../../../common/errors/app-error';
import type { ClosureRow, HoursRow } from '../../drawers';
import { localParts, zonedToUtc } from '../../drawers';

export type BookingStatus =
  'held' | 'confirmed' | 'active' | 'overdue' | 'completed' | 'cancelled' | 'expired' | 'no_show';

/** Statuses that still occupy the asset (the occupancy row is unreleased). */
export const LIVE_STATUSES: readonly BookingStatus[] = ['held', 'confirmed', 'active', 'overdue'];

/** The booking state machine (README §7.2). Anything not listed is illegal. */
const TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  held: ['confirmed', 'expired', 'cancelled'],
  confirmed: ['active', 'cancelled', 'no_show'],
  active: ['completed', 'overdue'],
  overdue: ['completed'],
  completed: [],
  cancelled: [],
  expired: [],
  no_show: [],
};

export const canTransition = (from: BookingStatus, to: BookingStatus): boolean =>
  TRANSITIONS[from].includes(to);

// ── errors ───────────────────────────────────────────────────────────────────────────────────────────
export const bookingNotFound = (): AppError =>
  new AppError({ status: 404, code: 'NOT_FOUND', detail: 'Booking not found' });
export const invalidState = (detail: string): AppError =>
  new AppError({ status: 409, code: 'INVALID_STATE', detail });
export const permissionDenied = (): AppError =>
  new AppError({
    status: 403,
    code: 'PERMISSION_DENIED',
    detail: 'You do not have permission for this action',
  });
export const holdExpired = (): AppError =>
  new AppError({
    status: 410,
    code: 'HOLD_EXPIRED',
    detail: 'The hold on this slot ran out and the slot has since been taken',
  });
export const paymentInvalid = (): AppError =>
  new AppError({
    status: 422,
    code: 'PAYMENT_INVALID',
    detail: 'The payment confirmation could not be verified',
  });
export const bookingField = (field: string, message: string): AppError =>
  new AppError({
    status: 422,
    code: 'VALIDATION_FAILED',
    detail: 'Request validation failed',
    errors: [{ field, message }],
  });
const rule = (code: 'DURATION_INVALID' | 'LEAD_TIME_VIOLATION' | 'DRAWER_CLOSED', detail: string) =>
  new AppError({ status: 422, code, detail });

// ── money ────────────────────────────────────────────────────────────────────────────────────────────
export const MINUTE_MS = 60_000;

export const rentalPrice = (durationMinutes: number, slotMinutes: number, perSlotPaise: number) =>
  (durationMinutes / slotMinutes) * perSlotPaise;

export interface RefundTier {
  readonly minutesBeforeStart: number;
  readonly percent: number;
}

/**
 * Refund percentage for a cancellation `minutesUntilStart` before the booking starts. Tiers are configuration (BR-9);
 * the first tier (largest threshold first) whose threshold is met applies, so exactly on a threshold is the better tier.
 */
export function refundPercent(minutesUntilStart: number, tiers: readonly RefundTier[]): number {
  const ordered = [...tiers].sort((a, b) => b.minutesBeforeStart - a.minutesBeforeStart);
  return ordered.find((tier) => minutesUntilStart >= tier.minutesBeforeStart)?.percent ?? 0;
}

/** Rental price refunded by the percentage (rounded down to whole paise) plus the whole deposit. */
export function refundAmount(pricePaise: number, depositPaise: number, percent: number): number {
  return Math.floor((pricePaise * percent) / 100) + depositPaise;
}

// ── the booking request ──────────────────────────────────────────────────────────────────────────────
export interface RequestRules {
  slotMinutes: number;
  minDurationMin: number;
  maxDurationMin: number;
  minLeadMinutes: number;
  maxAdvanceDays: number;
}

/** Cheap business-rule checks done before the transaction (README §9.4 step 1). Throws the matching 422. */
export function validateRequest(
  input: { startsAt: Date; durationMinutes: number },
  rules: RequestRules,
  now: Date,
): void {
  const { durationMinutes } = input;
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes % rules.slotMinutes !== 0 ||
    durationMinutes < rules.minDurationMin ||
    durationMinutes > rules.maxDurationMin
  ) {
    throw rule(
      'DURATION_INVALID',
      `Choose a duration that is a multiple of ${rules.slotMinutes} minutes, between ${rules.minDurationMin} and ${rules.maxDurationMin} minutes`,
    );
  }
  const lead = (input.startsAt.getTime() - now.getTime()) / MINUTE_MS;
  if (lead < rules.minLeadMinutes) {
    throw rule(
      'LEAD_TIME_VIOLATION',
      `Bookings must start at least ${rules.minLeadMinutes} minutes from now`,
    );
  }
  if (lead > rules.maxAdvanceDays * 24 * 60) {
    throw rule(
      'LEAD_TIME_VIOLATION',
      `Bookings can be made at most ${rules.maxAdvanceDays} days ahead`,
    );
  }
}

/**
 * The whole rental must lie inside one local day's opening hours and clear of closures (README §9.9). These are
 * business rules over local time, not a no-overlap invariant, so they are checked here and not by the constraint.
 */
export function assertDrawerOpen(
  drawer: { timezone: string; status: string },
  hours: readonly HoursRow[],
  closures: readonly ClosureRow[],
  startsAt: Date,
  endsAt: Date,
): void {
  const closed = (detail: string) => rule('DRAWER_CLOSED', detail);
  if (drawer.status !== 'active') throw closed('This drawer is not taking bookings right now');
  const local = localParts(startsAt, drawer.timezone);
  const today = hours.find((h) => h.weekday === local.weekday);
  if (!today) throw closed('The drawer is closed on that day');
  const opens = zonedToUtc(local.date, today.opens_at, drawer.timezone);
  const closes = zonedToUtc(local.date, today.closes_at, drawer.timezone);
  if (startsAt < opens || endsAt > closes) {
    throw closed('The rental must fit inside the drawer opening hours of a single day');
  }
  if (
    closures.some(
      (c) => c.starts_at.getTime() < endsAt.getTime() && startsAt.getTime() < c.ends_at.getTime(),
    )
  ) {
    throw closed('The drawer is closed during part of that time');
  }
}

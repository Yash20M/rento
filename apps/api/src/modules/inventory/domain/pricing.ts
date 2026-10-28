/**
 * Offers and "new" status of an item model (M29). Pure functions: the clock is passed in, nothing is read from the
 * database here, so every rule can be tested at the edges.
 *
 * Money is integer paise. The discount is rounded DOWN to whole paise, so the customer is never given more than the stated
 * percent, and the price actually charged is always `list − discount` (never negative, never fractional).
 */

/** An item model counts as a new arrival for this many days after it was added. */
export const NEW_ITEM_DAYS = 14;
export const MIN_DISCOUNT_PERCENT = 1;
export const MAX_DISCOUNT_PERCENT = 90;

const DAY_MS = 24 * 3600_000;

export interface OfferFields {
  discount_percent: number | null;
  discount_starts_at: Date | null;
  discount_ends_at: Date | null;
}

export interface EffectivePrice {
  /** The normal price of one slot. */
  listPaise: number;
  /** What one slot costs right now (equals [listPaise] without an active offer). */
  pricePaise: number;
  /** The percent off while an offer is active, else `null`. */
  discountPercent: number | null;
  /** When the active offer ends, `null` when it has no end or there is none. */
  discountEndsAt: Date | null;
}

/** Whole paise taken off [pricePaise] by [percent], rounded down. */
export const discountPaise = (pricePaise: number, percent: number): number =>
  Math.floor((pricePaise * percent) / 100);

/** Active when there is a percent and now is inside the half-open window `[starts, ends)`; either end may be open. */
export function isOfferActive(offer: OfferFields, now: Date): boolean {
  if (offer.discount_percent === null) return false;
  if (offer.discount_starts_at && now < offer.discount_starts_at) return false;
  if (offer.discount_ends_at && now >= offer.discount_ends_at) return false;
  return true;
}

export function effectiveSlotPrice(
  model: OfferFields & { price_per_slot_paise: number },
  now: Date,
): EffectivePrice {
  const listPaise = model.price_per_slot_paise;
  if (!isOfferActive(model, now) || model.discount_percent === null) {
    return { listPaise, pricePaise: listPaise, discountPercent: null, discountEndsAt: null };
  }
  return {
    listPaise,
    pricePaise: listPaise - discountPaise(listPaise, model.discount_percent),
    discountPercent: model.discount_percent,
    discountEndsAt: model.discount_ends_at,
  };
}

/** Added within the last [NEW_ITEM_DAYS] days. A creation time slightly in the future (clock skew) still counts. */
export const isNewItem = (createdAt: Date, now: Date): boolean =>
  now.getTime() - createdAt.getTime() < NEW_ITEM_DAYS * DAY_MS;

export interface OfferProblem {
  field: 'discountPercent' | 'discountStartsAt' | 'discountEndsAt';
  message: string;
}

/**
 * Rules of an offer as a whole. [endsChanged] says whether this request sets the end date: a new end in the past is a
 * mistake, but an offer that has simply run out is allowed to keep its old end date while other fields are edited.
 */
export function offerProblems(
  offer: { percent: number | null; startsAt: Date | null; endsAt: Date | null },
  now: Date,
  options: { endsChanged: boolean } = { endsChanged: true },
): OfferProblem[] {
  const problems: OfferProblem[] = [];
  if (offer.percent === null) {
    if (offer.startsAt)
      problems.push({ field: 'discountStartsAt', message: 'needs a discount percent' });
    if (offer.endsAt)
      problems.push({ field: 'discountEndsAt', message: 'needs a discount percent' });
    return problems;
  }
  if (
    !Number.isInteger(offer.percent) ||
    offer.percent < MIN_DISCOUNT_PERCENT ||
    offer.percent > MAX_DISCOUNT_PERCENT
  ) {
    problems.push({
      field: 'discountPercent',
      message: `must be a whole number from ${MIN_DISCOUNT_PERCENT} to ${MAX_DISCOUNT_PERCENT}`,
    });
  }
  if (offer.startsAt && offer.endsAt && offer.endsAt <= offer.startsAt) {
    problems.push({ field: 'discountEndsAt', message: 'must be after the start' });
  } else if (offer.endsAt && options.endsChanged && offer.endsAt <= now) {
    problems.push({ field: 'discountEndsAt', message: 'must be in the future' });
  }
  return problems;
}

export type OfferState = 'none' | 'scheduled' | 'active' | 'ended';

/** Where an offer is on the calendar, for the admin screens: none, scheduled (not begun), active or ended. */
export function offerState(offer: OfferFields, now: Date): OfferState {
  if (offer.discount_percent === null) return 'none';
  if (offer.discount_starts_at && now < offer.discount_starts_at) return 'scheduled';
  if (offer.discount_ends_at && now >= offer.discount_ends_at) return 'ended';
  return 'active';
}

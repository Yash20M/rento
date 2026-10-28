import { describe, expect, it } from 'vitest';
import {
  NEW_ITEM_DAYS,
  discountPaise,
  effectiveSlotPrice,
  isNewItem,
  isOfferActive,
  offerProblems,
} from '../../src/modules/inventory/domain/pricing';

const at = (iso: string) => new Date(iso);
const model = (over: Partial<Parameters<typeof effectiveSlotPrice>[0]> = {}) => ({
  price_per_slot_paise: 10_000,
  discount_percent: null,
  discount_starts_at: null,
  discount_ends_at: null,
  ...over,
});

describe('discount maths (M29)', () => {
  it('PR-1 the discount is a whole number of paise, rounded DOWN, so the customer never gets more than the stated percent', () => {
    expect(discountPaise(10_000, 20)).toBe(2_000);
    expect(discountPaise(9_999, 20)).toBe(1_999); // 1999.8 → 1999
    expect(discountPaise(1, 90)).toBe(0); // 0.9 → 0: a one-paise price cannot be reduced
    expect(discountPaise(0, 50)).toBe(0);
    expect(discountPaise(4_900, 15)).toBe(735);
  });

  it('PR-2 the price actually charged is the list price minus the discount, never below zero', () => {
    for (const price of [0, 1, 99, 4_900, 10_000_000]) {
      for (const pct of [1, 10, 33, 50, 90]) {
        const paid = price - discountPaise(price, pct);
        expect(paid).toBeGreaterThanOrEqual(0);
        expect(paid).toBeLessThanOrEqual(price);
        expect(Number.isInteger(paid)).toBe(true);
      }
    }
  });
});

describe('when an offer is active', () => {
  const o = (s: string | null, e: string | null) => ({
    discount_percent: 20,
    discount_starts_at: s ? at(s) : null,
    discount_ends_at: e ? at(e) : null,
  });

  it('PR-3 no percent means no offer, whatever the dates say', () => {
    expect(
      isOfferActive(
        { discount_percent: null, discount_starts_at: null, discount_ends_at: null },
        at('2030-01-01T00:00:00Z'),
      ),
    ).toBe(false);
  });

  it('PR-4 an open-ended offer is active as soon as it has begun, and for ever', () => {
    expect(isOfferActive(o(null, null), at('2030-01-01T00:00:00Z'))).toBe(true);
    expect(isOfferActive(o('2030-01-02T00:00:00Z', null), at('2030-01-01T23:59:59Z'))).toBe(false);
    expect(isOfferActive(o('2030-01-02T00:00:00Z', null), at('2030-01-02T00:00:00Z'))).toBe(true);
  });

  it('PR-5 the window is half-open like a booking: the start instant is in, the end instant is out', () => {
    const w = o('2030-01-01T00:00:00Z', '2030-01-08T00:00:00Z');
    expect(isOfferActive(w, at('2029-12-31T23:59:59.999Z'))).toBe(false);
    expect(isOfferActive(w, at('2030-01-01T00:00:00Z'))).toBe(true);
    expect(isOfferActive(w, at('2030-01-07T23:59:59.999Z'))).toBe(true);
    expect(isOfferActive(w, at('2030-01-08T00:00:00Z'))).toBe(false);
  });
});

describe('effective slot price', () => {
  it('PR-6 without an offer the customer pays the list price and no discount is reported', () => {
    expect(effectiveSlotPrice(model(), at('2030-01-01T00:00:00Z'))).toEqual({
      listPaise: 10_000,
      pricePaise: 10_000,
      discountPercent: null,
      discountEndsAt: null,
    });
  });

  it('PR-7 inside the window the price drops and the percent and end are reported', () => {
    const m = model({
      discount_percent: 25,
      discount_starts_at: at('2030-01-01T00:00:00Z'),
      discount_ends_at: at('2030-01-08T00:00:00Z'),
    });
    expect(effectiveSlotPrice(m, at('2030-01-03T00:00:00Z'))).toEqual({
      listPaise: 10_000,
      pricePaise: 7_500,
      discountPercent: 25,
      discountEndsAt: at('2030-01-08T00:00:00Z'),
    });
  });

  it('PR-8 after the window ends (or before it starts) the price is back to the list price', () => {
    const m = model({
      discount_percent: 25,
      discount_starts_at: at('2030-01-01T00:00:00Z'),
      discount_ends_at: at('2030-01-08T00:00:00Z'),
    });
    expect(effectiveSlotPrice(m, at('2030-01-08T00:00:00Z')).pricePaise).toBe(10_000);
    expect(effectiveSlotPrice(m, at('2029-12-01T00:00:00Z')).discountPercent).toBeNull();
  });
});

describe('new arrivals', () => {
  it(`PR-9 an item is new for ${NEW_ITEM_DAYS} days after it was added, not a moment longer`, () => {
    const created = at('2030-01-01T12:00:00Z');
    const day = 24 * 3600_000;
    expect(isNewItem(created, new Date(created.getTime()))).toBe(true);
    expect(isNewItem(created, new Date(created.getTime() + NEW_ITEM_DAYS * day - 1))).toBe(true);
    expect(isNewItem(created, new Date(created.getTime() + NEW_ITEM_DAYS * day))).toBe(false);
  });

  it('PR-10 a creation time in the future (clock skew) still counts as new', () => {
    expect(isNewItem(at('2030-01-02T00:00:00Z'), at('2030-01-01T00:00:00Z'))).toBe(true);
  });
});

describe('offer validation', () => {
  const now = at('2030-01-01T00:00:00Z');
  const fields = (r: ReturnType<typeof offerProblems>) => r.map((p) => p.field);

  it('PR-11 no offer at all is fine', () => {
    expect(offerProblems({ percent: null, startsAt: null, endsAt: null }, now)).toEqual([]);
  });

  it('PR-12 the percent must be a whole number from 1 to 90', () => {
    for (const bad of [0, -5, 91, 100, 12.5]) {
      expect(fields(offerProblems({ percent: bad, startsAt: null, endsAt: null }, now))).toEqual([
        'discountPercent',
      ]);
    }
    for (const good of [1, 20, 90]) {
      expect(offerProblems({ percent: good, startsAt: null, endsAt: null }, now)).toEqual([]);
    }
  });

  it('PR-13 dates without a percent are refused (they would silently do nothing)', () => {
    expect(
      fields(
        offerProblems({ percent: null, startsAt: at('2030-02-01T00:00:00Z'), endsAt: null }, now),
      ),
    ).toEqual(['discountStartsAt']);
    expect(
      fields(
        offerProblems({ percent: null, startsAt: null, endsAt: at('2030-02-01T00:00:00Z') }, now),
      ),
    ).toEqual(['discountEndsAt']);
  });

  it('PR-14 the end must be after the start', () => {
    const p = offerProblems(
      { percent: 10, startsAt: at('2030-02-02T00:00:00Z'), endsAt: at('2030-02-02T00:00:00Z') },
      now,
    );
    expect(fields(p)).toEqual(['discountEndsAt']);
    expect(p[0]?.message).toMatch(/after the start/);
  });

  it('PR-15 a NEW end date in the past is refused; an unchanged old one is not re-checked', () => {
    const ended = at('2029-12-01T00:00:00Z');
    expect(
      fields(
        offerProblems({ percent: 10, startsAt: null, endsAt: ended }, now, { endsChanged: true }),
      ),
    ).toEqual(['discountEndsAt']);
    expect(
      offerProblems({ percent: 10, startsAt: null, endsAt: ended }, now, { endsChanged: false }),
    ).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { requestHash } from '../../src/common/idempotency/idempotency.service';
import { loadConfig } from '../../src/config/app-config';
import {
  type BookingStatus,
  assertDrawerOpen,
  canTransition,
  refundAmount,
  refundPercent,
  rentalPrice,
  validateRequest,
} from '../../src/modules/booking/domain/booking-rules';
import { FakePaymentProvider } from '../../src/modules/payments/fake-payment-provider';

const TIERS = [
  { minutesBeforeStart: 1440, percent: 100 },
  { minutesBeforeStart: 120, percent: 50 },
  { minutesBeforeStart: 0, percent: 0 },
];

describe('refund policy (placeholder tiers, BR-9)', () => {
  it('R-1 the tier boundaries: exactly on a threshold is the better tier, one minute less is the next', () => {
    expect(refundPercent(100_000, TIERS)).toBe(100);
    expect(refundPercent(1440, TIERS)).toBe(100); // exactly 24 h
    expect(refundPercent(1439, TIERS)).toBe(50);
    expect(refundPercent(120, TIERS)).toBe(50); // exactly 2 h
    expect(refundPercent(119, TIERS)).toBe(0);
    expect(refundPercent(0, TIERS)).toBe(0);
  });

  it('R-2 after the start nothing is refunded by the tiers; unsorted tiers give the same answer', () => {
    expect(refundPercent(-30, TIERS)).toBe(0);
    expect(refundPercent(1440, [...TIERS].reverse())).toBe(100);
    expect(refundPercent(500, [])).toBe(0);
  });

  it('R-3 amounts are whole paise, rounded DOWN, and the deposit always comes back in full', () => {
    expect(refundAmount(9800, 20000, 100)).toBe(29800);
    expect(refundAmount(9800, 20000, 50)).toBe(4900 + 20000);
    expect(refundAmount(9801, 0, 50)).toBe(4900); // 4900.5 → 4900
    expect(refundAmount(9800, 20000, 0)).toBe(20000);
    expect(refundAmount(1, 0, 99)).toBe(0);
  });

  it('R-4 REFUND_TIERS is parsed from the environment and refuses nonsense', () => {
    const env = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://u:p@h/d',
      JWT_SECRET: 'x'.repeat(32),
    };
    expect(loadConfig(env).refundTiers).toEqual(TIERS);
    expect(loadConfig({ ...env, REFUND_TIERS: '0:10,60:80' }).refundTiers).toEqual([
      { minutesBeforeStart: 60, percent: 80 },
      { minutesBeforeStart: 0, percent: 10 },
    ]);
    for (const bad of ['1440:101,0:0', '1440:100', 'abc', '1440-100,0-0', '1440:100,-5:0']) {
      expect(() => loadConfig({ ...env, REFUND_TIERS: bad }), bad).toThrow(/REFUND_TIERS/);
    }
  });
});

describe('booking state machine', () => {
  const ALL: BookingStatus[] = [
    'held',
    'confirmed',
    'active',
    'overdue',
    'completed',
    'cancelled',
    'expired',
    'no_show',
  ];
  const ALLOWED: Array<[BookingStatus, BookingStatus]> = [
    ['held', 'confirmed'],
    ['held', 'expired'],
    ['held', 'cancelled'],
    ['confirmed', 'active'],
    ['confirmed', 'cancelled'],
    ['confirmed', 'no_show'],
    ['active', 'completed'],
    ['active', 'overdue'],
    ['overdue', 'completed'],
  ];

  it('M-1 exactly the listed transitions are legal — every other pair is rejected', () => {
    for (const from of ALL) {
      for (const to of ALL) {
        const expected = ALLOWED.some(([a, b]) => a === from && b === to);
        expect(canTransition(from, to), `${from} → ${to}`).toBe(expected);
      }
    }
  });

  it('M-2 finished bookings never move again', () => {
    for (const done of ['completed', 'cancelled', 'expired', 'no_show'] as const) {
      expect(
        ALL.some((to) => canTransition(done, to)),
        done,
      ).toBe(false);
    }
  });
});

describe('booking request rules', () => {
  const rules = {
    slotMinutes: 30,
    minDurationMin: 30,
    maxDurationMin: 240,
    minLeadMinutes: 15,
    maxAdvanceDays: 90,
  };
  const now = new Date('2030-01-07T03:00:00Z');
  const code = (startsAt: string, durationMinutes: number) => {
    try {
      validateRequest({ startsAt: new Date(startsAt), durationMinutes }, rules, now);
      return 'ok';
    } catch (error) {
      return (error as { code: string }).code;
    }
  };

  it('Q-1 duration: a multiple of the slot within min and max', () => {
    expect(code('2030-01-07T04:00:00Z', 60)).toBe('ok');
    expect(code('2030-01-07T04:00:00Z', 30)).toBe('ok');
    expect(code('2030-01-07T04:00:00Z', 240)).toBe('ok');
    for (const bad of [0, -30, 45, 29, 270, 241, 60.5]) {
      expect(code('2030-01-07T04:00:00Z', bad), String(bad)).toBe('DURATION_INVALID');
    }
  });

  it('Q-2 lead time: at least 15 minutes ahead (exactly 15 is fine), at most 90 days', () => {
    expect(code('2030-01-07T03:15:00Z', 60)).toBe('ok');
    expect(code('2030-01-07T03:14:00Z', 60)).toBe('LEAD_TIME_VIOLATION');
    expect(code('2030-01-07T02:00:00Z', 60)).toBe('LEAD_TIME_VIOLATION');
    expect(code('2030-04-07T03:00:00Z', 60)).toBe('ok'); // exactly 90 days
    expect(code('2030-04-07T03:01:00Z', 60)).toBe('LEAD_TIME_VIOLATION');
  });

  it('Q-3 the rental price is whole slots times the slot price', () => {
    expect(rentalPrice(60, 30, 4900)).toBe(9800);
    expect(rentalPrice(30, 30, 4900)).toBe(4900);
    expect(rentalPrice(240, 60, 15000)).toBe(60000);
  });

  describe('opening hours and closures', () => {
    const drawer = { timezone: 'Asia/Kolkata', status: 'active' };
    const hours = [{ drawer_id: 'd', weekday: 1, opens_at: '09:00:00', closes_at: '18:00:00' }];
    const closure = {
      id: 'c',
      drawer_id: 'd',
      starts_at: new Date('2030-01-07T08:30:00Z'), // 14:00 IST
      ends_at: new Date('2030-01-07T09:30:00Z'), // 15:00 IST
      reason: null,
    };
    const check = (from: string, to: string, d = drawer, closures = [closure]) => {
      try {
        assertDrawerOpen(d, hours, closures, new Date(from), new Date(to));
        return 'ok';
      } catch (error) {
        return (error as { code: string }).code;
      }
    };

    it('Q-4 inside one local day of opening hours; the edges are inclusive of the opening and closing instants', () => {
      // Monday 2030-01-07: 09:00 IST = 03:30Z, 18:00 IST = 12:30Z
      expect(check('2030-01-07T03:30:00Z', '2030-01-07T04:30:00Z')).toBe('ok');
      expect(check('2030-01-07T11:30:00Z', '2030-01-07T12:30:00Z')).toBe('ok');
      expect(check('2030-01-07T03:29:00Z', '2030-01-07T04:29:00Z')).toBe('DRAWER_CLOSED');
      expect(check('2030-01-07T11:30:00Z', '2030-01-07T12:31:00Z')).toBe('DRAWER_CLOSED');
    });

    it('Q-5 a day without hours, an inactive drawer and a closure all say DRAWER_CLOSED', () => {
      expect(check('2030-01-08T04:00:00Z', '2030-01-08T05:00:00Z')).toBe('DRAWER_CLOSED'); // Tuesday
      expect(
        check('2030-01-07T04:00:00Z', '2030-01-07T05:00:00Z', {
          ...drawer,
          status: 'temporarily_closed',
        }),
      ).toBe('DRAWER_CLOSED');
      expect(check('2030-01-07T08:00:00Z', '2030-01-07T09:00:00Z')).toBe('DRAWER_CLOSED'); // runs into the closure
      expect(check('2030-01-07T09:30:00Z', '2030-01-07T10:30:00Z')).toBe('ok'); // starts when it ends
      expect(check('2030-01-07T07:30:00Z', '2030-01-07T08:30:00Z')).toBe('ok'); // ends when it starts
    });
  });
});

describe('request hash', () => {
  it('H-1 same request ⇒ same hash whatever the key order; any difference changes it', () => {
    const a = requestHash('POST', '/v1/bookings', {
      drawerId: 'd',
      durationMinutes: 60,
      nested: { x: 1, y: [1, 2] },
    });
    const b = requestHash('POST', '/v1/bookings', {
      nested: { y: [1, 2], x: 1 },
      durationMinutes: 60,
      drawerId: 'd',
    });
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
    expect(requestHash('POST', '/v1/bookings', { drawerId: 'd', durationMinutes: 61 })).not.toBe(a);
    expect(
      requestHash('POST', '/v1/other', {
        drawerId: 'd',
        durationMinutes: 60,
        nested: { x: 1, y: [1, 2] },
      }),
    ).not.toBe(a);
    expect(requestHash('POST', '/p', { a: [1, 2] })).not.toBe(
      requestHash('POST', '/p', { a: [2, 1] }),
    );
  });
});

describe('fake payment provider', () => {
  const provider = new FakePaymentProvider('a-test-secret-that-is-long-enough-0123456789');
  it('F-1 a checkout it simulated verifies; any tampering does not', () => {
    const checkout = provider.simulateCheckout('fake_order_1');
    expect(provider.verifyPayment(checkout)).toBe(true);
    expect(provider.verifyPayment({ ...checkout, orderId: 'fake_order_2' })).toBe(false);
    expect(provider.verifyPayment({ ...checkout, paymentId: 'fake_pay_other' })).toBe(false);
    expect(provider.verifyPayment({ ...checkout, signature: 'x' })).toBe(false);
    expect(provider.verifyPayment({ ...checkout, signature: '' })).toBe(false);
  });

  it('F-2 another server secret cannot forge a signature', () => {
    const other = new FakePaymentProvider('a-different-secret-that-is-also-long-0123456');
    expect(provider.verifyPayment(other.simulateCheckout('fake_order_1'))).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { ApiError, errorMessage, fieldErrors, unwrap } from '@/api/errors';
import { SessionStore } from '@/auth/session';
import { canWith } from '@/auth/auth-context';
import { meWith, superAdminMe } from '@/test/render';
import {
  formatDuration,
  formatPaise,
  humanize,
  paiseToRupees,
  rupeesToPaise,
  zonedLocalToIso,
} from './format';

describe('money', () => {
  it('F-01 paise are shown as rupees with Indian grouping', () => {
    expect(formatPaise(0)).toBe('₹0.00');
    expect(formatPaise(4900)).toBe('₹49.00');
    expect(formatPaise(123450)).toBe('₹1,234.50');
    expect(formatPaise(1234500000)).toBe('₹1,23,45,000.00');
  });

  it('F-02 rupee input becomes whole paise; anything ambiguous is refused', () => {
    expect(rupeesToPaise('49')).toBe(4900);
    expect(rupeesToPaise('49.5')).toBe(4950);
    expect(rupeesToPaise('49.05')).toBe(4905);
    expect(rupeesToPaise(' ₹ 1,500.00 ')).toBe(150000);
    expect(rupeesToPaise('0')).toBe(0);
    for (const bad of ['', 'abc', '12.345', '-5', '1e3', '1.', '.5', '1,5,0.0.0', '99999999999']) {
      expect(rupeesToPaise(bad), bad).toBeUndefined();
    }
  });

  it('F-03 editing shows stored paise back as the text a person would type', () => {
    expect(paiseToRupees(4900)).toBe('49');
    expect(paiseToRupees(4950)).toBe('49.50');
    expect(rupeesToPaise(paiseToRupees(123457))).toBe(123457);
  });
});

describe('time', () => {
  it('F-04 a wall-clock time in a zone becomes the right UTC instant (India +05:30, London DST, New York)', () => {
    expect(zonedLocalToIso('2030-01-07T09:00', 'Asia/Kolkata')).toBe('2030-01-07T03:30:00.000Z');
    expect(zonedLocalToIso('2030-01-15T09:00', 'Europe/London')).toBe('2030-01-15T09:00:00.000Z');
    expect(zonedLocalToIso('2030-07-15T09:00', 'Europe/London')).toBe('2030-07-15T08:00:00.000Z');
    expect(zonedLocalToIso('2030-01-07T09:00', 'America/New_York')).toBe(
      '2030-01-07T14:00:00.000Z',
    );
    expect(zonedLocalToIso('2030-01-07T09:00', 'UTC')).toBe('2030-01-07T09:00:00.000Z');
  });

  it('F-05 malformed input is refused', () => {
    for (const bad of ['', '2030-01-07', '2030-01-07 09:00', '09:00', 'tomorrow']) {
      expect(zonedLocalToIso(bad, 'Asia/Kolkata'), bad).toBeUndefined();
    }
  });

  it('F-06 durations and labels read naturally', () => {
    expect(formatDuration(30)).toBe('30 min');
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(90)).toBe('1 h 30 min');
    expect(humanize('no_show')).toBe('No show');
  });
});

describe('errors', () => {
  const result = (status: number, error: unknown) => ({
    error,
    response: new Response(null, { status }),
  });

  it('F-07 unwrap returns data for success and throws a typed error for a problem', () => {
    expect(unwrap({ data: { a: 1 }, response: new Response(null, { status: 200 }) })).toEqual({
      a: 1,
    });
    const problem = {
      code: 'ALREADY_EXISTS',
      detail: 'exists',
      errors: [
        { field: 'slug', message: 'taken' },
        { field: 'slug', message: 'again' },
      ],
    };
    try {
      unwrap(result(409, problem));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe('ALREADY_EXISTS');
      expect((error as ApiError).status).toBe(409);
      expect(fieldErrors(error)).toEqual({ slug: 'taken' }); // the first message per field wins
    }
  });

  it('F-08 a body that is not a problem still produces a sensible error', () => {
    expect(() => unwrap(result(502, undefined))).toThrowError('The request failed (502)');
    try {
      unwrap(result(502, 'gateway html'));
    } catch (error) {
      expect((error as ApiError).code).toBe('UNKNOWN');
    }
  });

  it('F-09 messages for people: permission, busy, network, unknown', () => {
    expect(errorMessage(new ApiError(403, 'PERMISSION_DENIED', 'x'))).toBe(
      'You do not have permission to do that.',
    );
    expect(errorMessage(new ApiError(503, 'RETRY_LATER', 'x'))).toMatch(/busy/);
    expect(errorMessage(new TypeError('Failed to fetch'))).toMatch(/Cannot reach the server/);
    expect(errorMessage(new Error('stack trace secrets'))).toBe(
      'Something went wrong. Please try again.',
    );
    expect(errorMessage(new ApiError(409, 'IN_USE', 'Still referenced'))).toBe('Still referenced');
    expect(errorMessage('plain text')).toBe('plain text');
  });
});

describe('session store', () => {
  it('F-10 the access token lives in memory only: a new store (a reload) has none, nothing is written to browser storage', () => {
    const before = window.sessionStorage.length + window.localStorage.length;
    const store = new SessionStore();
    store.setAccess('a');
    expect(store.accessToken).toBe('a');
    expect(window.sessionStorage.length + window.localStorage.length).toBe(before);
    expect(new SessionStore().accessToken).toBeUndefined();
    store.clear();
    expect(store.accessToken).toBeUndefined();
  });

  it('F-11 a forced sign-out notifies listeners, a normal clear does not', () => {
    const store = new SessionStore();
    let calls = 0;
    const off = store.onForcedSignOut(() => (calls += 1));
    store.clear();
    store.clear(true);
    off();
    store.clear(true);
    expect(calls).toBe(1);
  });
});

describe('permission checks in the UI', () => {
  it('F-13 canWith: Super Admin may everything; plain grants; drawer-limited grants only for their drawers', () => {
    expect(canWith(undefined, 'bookings:read')).toBe(false);
    expect(canWith(superAdminMe, 'anything:new')).toBe(true);
    const staff = meWith(
      ['bookings:read', 'bookings:cancel'],
      [{ permission: 'bookings:cancel', drawerIds: ['d-1'] }],
    );
    expect(canWith(staff, 'bookings:read')).toBe(true);
    expect(canWith(staff, 'bookings:read', 'd-9')).toBe(true); // unrestricted
    expect(canWith(staff, 'bookings:cancel')).toBe(true); // "some drawer" is enough for the menu
    expect(canWith(staff, 'bookings:cancel', 'd-1')).toBe(true);
    expect(canWith(staff, 'bookings:cancel', 'd-9')).toBe(false);
    expect(canWith(staff, 'roles:manage')).toBe(false);
  });
});

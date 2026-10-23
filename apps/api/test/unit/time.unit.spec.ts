import { describe, expect, it } from 'vitest';
import {
  isCalendarDate,
  isValidTimeZone,
  isoWeekday,
  localParts,
  zonedToUtc,
} from '../../src/modules/drawers/domain/time';

describe('time zones', () => {
  it('T-1 accepts real IANA names and rejects abbreviations, offsets and junk', () => {
    for (const ok of ['Asia/Kolkata', 'Europe/London', 'America/Argentina/Buenos_Aires', 'UTC']) {
      expect(isValidTimeZone(ok), ok).toBe(true);
    }
    for (const bad of [
      'IST',
      'GMT+5',
      '+05:30',
      'Mars/Olympus',
      'Asia/',
      '',
      'asia kolkata',
      'Asia/Kolkata; DROP',
    ]) {
      expect(isValidTimeZone(bad), bad).toBe(false);
    }
  });

  it('T-2 localParts reads the wall clock of an instant (India has no DST, +05:30)', () => {
    expect(localParts(new Date('2030-01-01T00:00:00Z'), 'Asia/Kolkata')).toEqual({
      date: '2030-01-01',
      time: '05:30:00',
      weekday: 2, // Tuesday
    });
    // 20:00 UTC on Monday is already Tuesday 01:30 in India
    expect(localParts(new Date('2030-01-07T20:00:00Z'), 'Asia/Kolkata')).toMatchObject({
      date: '2030-01-08',
      weekday: 2,
    });
  });

  it('T-3 zonedToUtc converts a local opening time to the right instant', () => {
    expect(zonedToUtc('2030-01-01', '09:00', 'Asia/Kolkata').toISOString()).toBe(
      '2030-01-01T03:30:00.000Z',
    );
    expect(zonedToUtc('2030-01-01', '23:59:59', 'Asia/Kolkata').toISOString()).toBe(
      '2030-01-01T18:29:59.000Z',
    );
  });

  it('T-4 zonedToUtc round-trips through localParts', () => {
    const instant = zonedToUtc('2030-06-15', '17:45', 'Asia/Kolkata');
    expect(localParts(instant, 'Asia/Kolkata')).toMatchObject({
      date: '2030-06-15',
      time: '17:45:00',
    });
  });

  it('T-5 daylight saving: London is +0 in winter and +1 in summer', () => {
    expect(zonedToUtc('2030-01-15', '09:00', 'Europe/London').toISOString()).toBe(
      '2030-01-15T09:00:00.000Z',
    );
    expect(zonedToUtc('2030-07-15', '09:00', 'Europe/London').toISOString()).toBe(
      '2030-07-15T08:00:00.000Z',
    );
  });

  it('T-6 isoWeekday and isCalendarDate', () => {
    expect(isoWeekday('2030-01-07')).toBe(1); // Monday
    expect(isoWeekday('2030-01-06')).toBe(7); // Sunday
    expect(isCalendarDate('2030-02-28')).toBe(true);
    for (const bad of ['2030-02-30', '2030-13-01', '30-01-2030', '2030-1-1', '', 'tomorrow']) {
      expect(isCalendarDate(bad), bad).toBe(false);
    }
  });
});

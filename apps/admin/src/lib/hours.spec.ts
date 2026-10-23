import { describe, expect, it } from 'vitest';
import { summariseHours } from './hours';

const day = (weekday: number, opensAt = '09:00', closesAt = '21:00') => ({
  weekday,
  opensAt,
  closesAt,
});

describe('summariseHours', () => {
  it('H-01 no hours says so', () => {
    expect(summariseHours([])).toBe('No opening hours set');
  });

  it('H-02 seven identical days are "Every day"', () => {
    expect(summariseHours([1, 2, 3, 4, 5, 6, 7].map((d) => day(d)))).toBe('Every day 09:00–21:00');
  });

  it('H-03 days in a row with the same hours are one group; a different day starts a new one', () => {
    const hours = [
      ...[1, 2, 3, 4, 5].map((d) => day(d, '09:00', '18:00')),
      day(6, '10:00', '14:00'),
      day(7, '10:00', '14:00'),
    ];
    expect(summariseHours(hours)).toBe('Mon–Fri 09:00–18:00 · Sat–Sun 10:00–14:00');
  });

  it('H-04 days with no hours are named as closed, and a gap splits a group', () => {
    expect(summariseHours([day(1), day(2), day(4), day(5)])).toBe(
      'Mon–Tue 09:00–21:00 · Thu–Fri 09:00–21:00 · closed Wed, Sat, Sun',
    );
  });

  it('H-05 a single day, and unsorted input, read correctly', () => {
    expect(summariseHours([day(3)])).toBe('Wed 09:00–21:00 · closed Mon, Tue, Thu, Fri, Sat, Sun');
    expect(summariseHours([day(2), day(1)])).toBe(
      'Mon–Tue 09:00–21:00 · closed Wed, Thu, Fri, Sat, Sun',
    );
  });
});

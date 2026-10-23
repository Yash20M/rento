import { describe, expect, it } from 'vitest';
import { SystemClock } from '../../src/common/clock/clock';
import { FakeClock } from '../support/fake-clock';

describe('Clock', () => {
  it('U-11 FakeClock is deterministic and only moves when told to', () => {
    const clock = new FakeClock('2030-01-01T10:00:00Z');
    expect(clock.now().toISOString()).toBe('2030-01-01T10:00:00.000Z');
    clock.advance(90_000);
    expect(clock.now().toISOString()).toBe('2030-01-01T10:01:30.000Z');
    clock.set('2031-06-01T00:00:00Z');
    expect(clock.now().toISOString()).toBe('2031-06-01T00:00:00.000Z');
  });

  it('U-11b FakeClock hands out copies (callers cannot mutate its state)', () => {
    const clock = new FakeClock('2030-01-01T10:00:00Z');
    clock.now().setUTCFullYear(1999);
    expect(clock.now().getUTCFullYear()).toBe(2030);
  });

  it('U-12 SystemClock returns the real current time', () => {
    const before = Date.now();
    const now = new SystemClock().now().getTime();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now - before).toBeLessThan(1000);
  });
});

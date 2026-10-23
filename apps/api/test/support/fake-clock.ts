import type { Clock } from '../../src/common/clock/clock';

/** Deterministic clock for tests. Never reads real time; advance it explicitly instead of sleeping. */
export class FakeClock implements Clock {
  private current: Date;

  constructor(start: Date | string = '2030-01-01T00:00:00Z') {
    this.current = new Date(start);
  }

  now(): Date {
    return new Date(this.current);
  }

  set(instant: Date | string): void {
    this.current = new Date(instant);
  }

  advance(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}

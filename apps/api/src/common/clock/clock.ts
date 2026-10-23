export const CLOCK = Symbol('CLOCK');

/** Source of "now". Inject it instead of calling `new Date()` so tests can control time. */
export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

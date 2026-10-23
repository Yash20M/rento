import { Inject, Injectable } from '@nestjs/common';
import type { AppConfig } from '../../config/app-config';
import { APP_CONFIG } from '../../config/config.module';
import { CLOCK, type Clock } from '../clock/clock';
import { AppError } from '../errors/app-error';
import { SlidingWindow } from './sliding-window';

const MINUTE_MS = 60_000;
const MAX_LOCK_FACTOR = 8;

interface Failures {
  count: number;
  windowStart: number;
  lockedUntil: number;
  strikes: number;
}

const tooMany = (retryAfterMs: number, detail: string): AppError =>
  new AppError({
    status: 429,
    code: 'RATE_LIMITED',
    detail,
    headers: { 'retry-after': String(Math.max(1, Math.ceil(retryAfterMs / 1000))) },
  });

/**
 * Per-instance request limits and the progressive sign-in lockout (README §15). State lives in memory: enough for one
 * instance; running several needs a shared store (README §4), at which point only this class changes.
 */
@Injectable()
export class RateLimitService {
  private readonly windows = new SlidingWindow();
  private readonly pairs = new Map<string, Failures>();
  private readonly accounts = new Map<string, Failures>();

  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  get enabled(): boolean {
    return this.config.rateLimitEnabled;
  }

  /** Counts one request against `scope:key`; throws `429` + `Retry-After` beyond `limit` per minute. */
  consume(scope: string, key: string, limitPerMinute: number): void {
    if (!this.enabled) return;
    const result = this.windows.hit(
      `${scope}:${key}`,
      limitPerMinute,
      MINUTE_MS,
      this.clock.now().getTime(),
    );
    if (!result.allowed) {
      throw tooMany(
        result.retryAfterMs,
        'Too many requests. Please slow down and try again shortly',
      );
    }
  }

  // ── sign-in lockout ──────────────────────────────────────────────────────────────────────────────
  /** Throws while this address+account pair (or the whole account, after a distributed attack) is locked. */
  assertLoginAllowed(email: string, ip: string): void {
    if (!this.enabled) return;
    const now = this.clock.now().getTime();
    const entries = [
      this.pairs.get(this.pairKey(email, ip)),
      this.accounts.get(email.toLowerCase()),
    ];
    for (const entry of entries) {
      if (entry && entry.lockedUntil > now) {
        throw tooMany(
          entry.lockedUntil - now,
          'Too many failed sign-in attempts. Try again later, or reset your password',
        );
      }
    }
  }

  recordLoginFailure(email: string, ip: string): void {
    if (!this.enabled) return;
    const now = this.clock.now().getTime();
    this.fail(this.pairs, this.pairKey(email, ip), this.config.loginMaxFailures, now);
    // Many different addresses against one account: lock the account itself, with a higher bar.
    this.fail(this.accounts, email.toLowerCase(), this.config.loginMaxFailures * 5, now);
  }

  recordLoginSuccess(email: string, ip: string): void {
    this.pairs.delete(this.pairKey(email, ip));
  }

  private pairKey(email: string, ip: string): string {
    return `${email.toLowerCase()}|${ip}`;
  }

  private fail(map: Map<string, Failures>, key: string, max: number, now: number): void {
    const lockMs = this.config.loginLockMinutes * MINUTE_MS;
    const entry = map.get(key) ?? { count: 0, windowStart: now, lockedUntil: 0, strikes: 0 };
    // Failures older than the lock period no longer count (and a long quiet time forgives earlier strikes).
    if (now - entry.windowStart > lockMs) {
      entry.count = 0;
      entry.windowStart = now;
      if (now - entry.lockedUntil > lockMs * MAX_LOCK_FACTOR) entry.strikes = 0;
    }
    entry.count += 1;
    if (entry.count >= max) {
      // Each lock is twice as long as the one before, up to eight times the base.
      const factor = Math.min(2 ** entry.strikes, MAX_LOCK_FACTOR);
      entry.lockedUntil = now + lockMs * factor;
      entry.strikes += 1;
      entry.count = 0;
      entry.windowStart = now;
    }
    map.set(key, entry);
  }
}

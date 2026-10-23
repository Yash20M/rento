import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_POLICY = 'rento:rate-limit-policy';

export type RateLimitPolicy = 'auth' | 'booking';

/**
 * Marks a route with the rate-limit policy it must be subject to. This is only the hook: the throttler that
 * enforces it (per-IP and per-account, `429` + `Retry-After`) is implemented in P2-31.
 */
export const RateLimited = (policy: RateLimitPolicy) => SetMetadata(RATE_LIMIT_POLICY, policy);

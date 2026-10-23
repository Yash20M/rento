import { type JSONWebKeySet, createLocalJWKSet } from 'jose';
import type { Clock } from '../../../../common/clock/clock';
import { RetryLaterError } from '../../../../db/errors';

const SECOND_MS = 1000;
const MIN_LIFETIME_MS = 60 * SECOND_MS;
const MAX_LIFETIME_MS = 24 * 60 * 60 * SECOND_MS;
const DEFAULT_LIFETIME_MS = 60 * 60 * SECOND_MS;
/** After a failed refresh the stale keys are used for this long before the endpoint is tried again. */
const FAILURE_BACKOFF_MS = 30 * SECOND_MS;
/** At most one refetch per this long because of an unknown `kid` — a forged `kid` must not cost a fetch per request. */
const MISS_REFETCH_INTERVAL_MS = 30 * SECOND_MS;
const FETCH_TIMEOUT_MS = 5 * SECOND_MS;
const MAX_BODY_BYTES = 256 * 1024;

export type KeyResolver = ReturnType<typeof createLocalJWKSet>;

export interface JwksLogger {
  warn(message: string): void;
}

/** `max-age` of a Cache-Control header in milliseconds, clamped; the default when absent or unusable. */
export function cacheLifetimeMs(cacheControl: string | null | undefined): number {
  const match = /(?:^|[\s,])max-age\s*=\s*(\d{1,10})(?=$|[\s,;])/i.exec(cacheControl ?? '');
  if (!match?.[1]) return DEFAULT_LIFETIME_MS;
  return Math.min(MAX_LIFETIME_MS, Math.max(MIN_LIFETIME_MS, Number(match[1]) * SECOND_MS));
}

interface Snapshot {
  resolver: KeyResolver;
  kids: ReadonlySet<string>;
  expiresAt: number;
}

/**
 * Caches a provider's JSON Web Key Set the way HTTP says to: until `Cache-Control: max-age` runs out (clamped), with
 * the injected Clock. Beyond that:
 *  - an unknown `kid` (key rotation) triggers one refetch, throttled so it cannot be abused;
 *  - a failing endpoint never takes sign-in down while stale keys exist, and is not hammered;
 *  - concurrent callers share one in-flight request.
 */
export class JwksCache {
  private snapshot: Snapshot | undefined;
  private inFlight: Promise<void> | undefined;
  private lastMissRefetchAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly url: string,
    private readonly clock: Clock,
    private readonly logger: JwksLogger,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  /**
   * Resolver for the key set that should verify a token with this `kid`.
   * @throws RetryLaterError when no keys are available at all and the endpoint cannot be reached.
   */
  async resolverFor(kid: string | undefined): Promise<KeyResolver> {
    const now = this.clock.now().getTime();

    if (!this.snapshot || now >= this.snapshot.expiresAt) {
      await this.refresh();
    } else if (kid !== undefined && !this.snapshot.kids.has(kid)) {
      if (now - this.lastMissRefetchAt >= MISS_REFETCH_INTERVAL_MS) {
        this.lastMissRefetchAt = now;
        await this.refresh();
      }
    }

    if (!this.snapshot) throw new RetryLaterError();
    return this.snapshot.resolver;
  }

  private refresh(): Promise<void> {
    this.inFlight ??= this.load().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  private async load(): Promise<void> {
    try {
      const response = await this.fetchImpl(this.url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
      const text = await response.text();
      if (text.length > MAX_BODY_BYTES) throw new Error('response too large');
      const jwks = JSON.parse(text) as JSONWebKeySet;
      if (!Array.isArray(jwks.keys)) throw new Error('no keys array');

      this.snapshot = {
        resolver: createLocalJWKSet(jwks),
        kids: new Set(jwks.keys.flatMap((key) => (typeof key.kid === 'string' ? [key.kid] : []))),
        expiresAt:
          this.clock.now().getTime() + cacheLifetimeMs(response.headers.get('cache-control')),
      };
    } catch (error) {
      // Class and message of OUR fetch problem only: nothing here can contain a user's token.
      this.logger.warn(
        `could not refresh signing keys (${error instanceof Error ? error.name : 'error'}); ${
          this.snapshot ? 'using cached keys' : 'no cached keys'
        }`,
      );
      if (this.snapshot) {
        this.snapshot = {
          ...this.snapshot,
          expiresAt: this.clock.now().getTime() + FAILURE_BACKOFF_MS,
        };
      }
    }
  }
}

/** Counts events per key over a sliding time window. Pure: the caller supplies the time. */
export class SlidingWindow {
  private readonly hits = new Map<string, number[]>();
  private sinceCleanup = 0;

  /** Records one event for `key` and says whether it is within `limit` per `windowMs`. */
  hit(
    key: string,
    limit: number,
    windowMs: number,
    now: number,
  ): { allowed: boolean; retryAfterMs: number } {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      // A rejected event does not extend the window: the caller may try again when the oldest one ages out.
      this.hits.set(key, recent);
      return { allowed: false, retryAfterMs: windowMs - (now - recent[0]!) };
    }
    recent.push(now);
    this.hits.set(key, recent);
    this.cleanup(now, windowMs);
    return { allowed: true, retryAfterMs: 0 };
  }

  /** Forgets keys whose events have all aged out, so a long-running process does not keep every address it ever saw. */
  private cleanup(now: number, windowMs: number): void {
    this.sinceCleanup += 1;
    if (this.sinceCleanup < 500) return;
    this.sinceCleanup = 0;
    for (const [key, times] of this.hits) {
      if (times.every((t) => now - t >= windowMs)) this.hits.delete(key);
    }
  }
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const PRUNE_ABOVE = 10_000;

/**
 * Fixed-window limiter. Returns true if the call is allowed.
 * State is in memory, so on serverless hosting each instance counts separately: this slows
 * abuse down, it isn't a hard guarantee.
 */
export function allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  if (buckets.size > PRUNE_ABOVE) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count++;
  return true;
}

export function resetRateLimits(): void {
  buckets.clear();
}

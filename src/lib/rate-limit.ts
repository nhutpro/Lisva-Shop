// A small in-memory sliding-window limiter. It lives in one server process: it resets when the
// server restarts and is not shared between instances, so it only slows down simple abuse.
// Swap it for a shared store (for example Redis) if the shop ever runs on several instances.

type Options = { limit: number; windowMs: number; now?: () => number };

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterMs: number };

const MAX_KEYS = 10_000;

export function createRateLimiter({ limit, windowMs, now = Date.now }: Options) {
  const hits = new Map<string, number[]>();

  return {
    /** Records an attempt when it is allowed. */
    check(key: string): RateLimitResult {
      const time = now();
      const recent = (hits.get(key) ?? []).filter((t) => time - t < windowMs);

      if (recent.length >= limit) {
        hits.set(key, recent);
        return { allowed: false, retryAfterMs: windowMs - (time - recent[0]) };
      }

      recent.push(time);
      hits.set(key, recent);

      // Keep memory bounded: drop keys whose attempts have all expired.
      if (hits.size > MAX_KEYS) {
        for (const [k, times] of hits) if (times.every((t) => time - t >= windowMs)) hits.delete(k);
      }
      return { allowed: true };
    },
    reset() {
      hits.clear();
    },
  };
}

/** Order requests: 5 per 10 minutes per client address. */
export const orderRateLimiter = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

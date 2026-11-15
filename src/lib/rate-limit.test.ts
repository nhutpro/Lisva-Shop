import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

const clock = (start = 1_000_000) => {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
};

describe("createRateLimiter", () => {
  it("allows up to the limit, then blocks and says how long to wait", () => {
    const c = clock();
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, now: c.now });

    expect(limiter.check("a")).toEqual({ allowed: true });
    c.advance(10_000);
    expect(limiter.check("a")).toEqual({ allowed: true });
    c.advance(10_000);
    expect(limiter.check("a")).toEqual({ allowed: true });

    c.advance(10_000);
    expect(limiter.check("a")).toEqual({ allowed: false, retryAfterMs: 30_000 }); // first hit expires in 30 s
  });

  it("allows again once the oldest attempts leave the window", () => {
    const c = clock();
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000, now: c.now });
    limiter.check("a");
    limiter.check("a");
    expect(limiter.check("a").allowed).toBe(false);

    c.advance(60_001);
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("does not count blocked attempts, so waiting is enough to get through", () => {
    const c = clock();
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: c.now });
    limiter.check("a");
    for (let i = 0; i < 20; i++) {
      c.advance(10);
      expect(limiter.check("a").allowed).toBe(false);
    }
    c.advance(1000);
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("keeps separate counters per key and can be reset", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("b").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
    limiter.reset();
    expect(limiter.check("a").allowed).toBe(true);
  });
});

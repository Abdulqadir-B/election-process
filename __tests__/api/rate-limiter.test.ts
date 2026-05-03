/**
 * Unit tests for the rate limiter logic used in /api/chat
 * Tests the sliding window, per-IP limiting, and window reset behavior.
 */

// ── Extracted rate limiter (mirrors route.ts logic) ────────────────────────
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 10;

function createRateLimiter() {
  const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

  function isRateLimited(ip: string, now = Date.now()): boolean {
    const entry = rateLimitMap.get(ip);

    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.set(ip, { count: 1, windowStart: now });
      return false;
    }

    if (entry.count >= MAX_REQUESTS) {
      return true;
    }

    entry.count++;
    return false;
  }

  function cleanup(now = Date.now()) {
    for (const [ip, entry] of rateLimitMap.entries()) {
      if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
        rateLimitMap.delete(ip);
      }
    }
  }

  return { isRateLimited, cleanup, rateLimitMap };
}
// ───────────────────────────────────────────────────────────────────────────

describe('Rate Limiter', () => {
  let rl: ReturnType<typeof createRateLimiter>;
  const BASE_TIME = 1000000;

  beforeEach(() => {
    rl = createRateLimiter();
  });

  test('allows the first request from a new IP', () => {
    expect(rl.isRateLimited('1.2.3.4', BASE_TIME)).toBe(false);
  });

  test('allows up to MAX_REQUESTS requests within the window', () => {
    for (let i = 0; i < MAX_REQUESTS; i++) {
      expect(rl.isRateLimited('1.2.3.4', BASE_TIME)).toBe(false);
    }
  });

  test('blocks the request after MAX_REQUESTS are exceeded', () => {
    for (let i = 0; i < MAX_REQUESTS; i++) {
      rl.isRateLimited('1.2.3.4', BASE_TIME);
    }
    expect(rl.isRateLimited('1.2.3.4', BASE_TIME)).toBe(true);
  });

  test('does not affect a different IP', () => {
    for (let i = 0; i <= MAX_REQUESTS; i++) {
      rl.isRateLimited('1.2.3.4', BASE_TIME);
    }
    // A completely different IP should still be allowed
    expect(rl.isRateLimited('9.9.9.9', BASE_TIME)).toBe(false);
  });

  test('resets the counter after the time window expires', () => {
    for (let i = 0; i < MAX_REQUESTS; i++) {
      rl.isRateLimited('1.2.3.4', BASE_TIME);
    }
    // Simulate time advancing past the rate limit window
    const futureTime = BASE_TIME + RATE_LIMIT_WINDOW_MS + 1;
    expect(rl.isRateLimited('1.2.3.4', futureTime)).toBe(false);
  });

  test('cleanup removes stale entries older than 2x window', () => {
    rl.isRateLimited('stale-ip', BASE_TIME);
    expect(rl.rateLimitMap.has('stale-ip')).toBe(true);

    // Cleanup called at a time 2x the window has passed
    rl.cleanup(BASE_TIME + RATE_LIMIT_WINDOW_MS * 2 + 1);
    expect(rl.rateLimitMap.has('stale-ip')).toBe(false);
  });

  test('cleanup does NOT remove entries within the active window', () => {
    rl.isRateLimited('active-ip', BASE_TIME);
    // Only 1 window has passed — not enough to be cleaned up
    rl.cleanup(BASE_TIME + RATE_LIMIT_WINDOW_MS + 1);
    expect(rl.rateLimitMap.has('active-ip')).toBe(true);
  });
});

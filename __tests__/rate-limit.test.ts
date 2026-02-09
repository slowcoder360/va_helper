import { describe, it, expect, beforeEach } from "vitest";

// Inline rate limiter for testing (mirrors the one in the route)
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;

let rateLimitMap: Map<string, { count: number; resetAt: number }>;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  entry.count++;
  return true;
}

describe("Rate Limiter", () => {
  beforeEach(() => {
    rateLimitMap = new Map();
  });

  it("should allow the first request", () => {
    expect(checkRateLimit("user1")).toBe(true);
  });

  it("should allow up to MAX_REQUESTS within the window", () => {
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      expect(checkRateLimit("user1")).toBe(true);
    }
  });

  it("should reject requests beyond MAX_REQUESTS", () => {
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      checkRateLimit("user1");
    }
    expect(checkRateLimit("user1")).toBe(false);
  });

  it("should track users independently", () => {
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      checkRateLimit("user1");
    }
    // user1 is rate limited, user2 should still be allowed
    expect(checkRateLimit("user1")).toBe(false);
    expect(checkRateLimit("user2")).toBe(true);
  });

  it("should reset after the window expires", () => {
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      checkRateLimit("user1");
    }
    expect(checkRateLimit("user1")).toBe(false);

    // Simulate window expiration by manipulating the entry
    const entry = rateLimitMap.get("user1")!;
    entry.resetAt = Date.now() - 1;

    expect(checkRateLimit("user1")).toBe(true);
  });
});

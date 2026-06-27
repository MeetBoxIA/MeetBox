/**
 * In-process rate limiter keyed by an arbitrary string (e.g. an email).
 * Mirrors the pattern of otp-store.ts / reset-token-store.ts — a sliding
 * window of timestamps per key, kept in memory across hot reloads.
 */

declare global {
  // eslint-disable-next-line no-var
  var __rateLimitStore: Map<string, number[]> | undefined;
}

const store: Map<string, number[]> =
  globalThis.__rateLimitStore ??
  (globalThis.__rateLimitStore = new Map());

/**
 * Records an attempt for `key` and returns whether it's allowed under the
 * sliding window — at most `max` attempts within the last `windowMs`.
 */
export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (store.get(key) ?? []).filter((t) => now - t < windowMs);

  if (timestamps.length >= max) {
    store.set(key, timestamps);
    return false;
  }

  timestamps.push(now);
  store.set(key, timestamps);
  return true;
}

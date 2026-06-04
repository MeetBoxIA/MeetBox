/**
 * In-process OTP store for email verification.
 * Stores one-time codes keyed by email with a 10-minute TTL.
 * Intentionally avoids a DB round-trip — codes are short-lived and
 * don't need to survive a server restart.
 */

declare global {
  // eslint-disable-next-line no-var
  var __otpStore: Map<string, { code: string; expiresAt: number }> | undefined;
}

// Attach to globalThis so the same Map instance survives hot-reloads in
// Next.js dev mode (each hot-reload re-evaluates modules but keeps globals).
const store: Map<string, { code: string; expiresAt: number }> =
  globalThis.__otpStore ?? (globalThis.__otpStore = new Map());

/** Persist a code for 10 minutes, replacing any prior code for that email. */
export function saveOTP(email: string, code: string) {
  store.set(email.toLowerCase(), {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
}

/**
 * Validate and consume a code.
 * Deletes the entry on both success and expiry to prevent replay attacks.
 * Returns false if no code exists, if it has expired, or if it doesn't match.
 */
export function checkOTP(email: string, code: string): boolean {
  const entry = store.get(email.toLowerCase());
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    store.delete(email.toLowerCase());
    return false;
  }
  if (entry.code !== code) return false;
  // Single-use: delete immediately after successful verification
  store.delete(email.toLowerCase());
  return true;
}

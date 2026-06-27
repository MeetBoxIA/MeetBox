/**
 * In-process store for password-reset tokens.
 * Mirrors the pattern of otp-store.ts.
 * Each token is 64 hex chars (32 random bytes), stored as-is (the API
 * only exposes a signed URL — the token itself is never shown in HTML).
 */

interface ResetEntry {
  token: string;
  expiresAt: number;
  used: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var __resetTokenStore: Map<string, ResetEntry> | undefined;
}

// Survive Next.js hot reloads in development.
const store: Map<string, ResetEntry> =
  globalThis.__resetTokenStore ??
  (globalThis.__resetTokenStore = new Map());

const TTL_MS = 30 * 60 * 1000; // 30 minutes

/** Save a reset token for the given email (overwrites any previous token). */
export function saveResetToken(email: string, token: string): void {
  store.set(email.toLowerCase(), { token, expiresAt: Date.now() + TTL_MS, used: false });
}

export type TokenCheckResult =
  | { valid: true }
  | { valid: false; reason: "missing" | "expired" | "used" | "invalid" };

/** Validate a reset token. Does NOT consume it — call consumeResetToken on success. */
export function checkResetToken(email: string, token: string): TokenCheckResult {
  const key   = email.toLowerCase();
  const entry = store.get(key);
  if (!entry)              return { valid: false, reason: "missing"  };
  if (entry.used)          return { valid: false, reason: "used"     };
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return { valid: false, reason: "expired" };
  }
  if (entry.token !== token) return { valid: false, reason: "invalid" };
  return { valid: true };
}

/** Mark the token as used so it cannot be replayed. */
export function consumeResetToken(email: string): void {
  const key   = email.toLowerCase();
  const entry = store.get(key);
  if (entry) store.delete(key);
}

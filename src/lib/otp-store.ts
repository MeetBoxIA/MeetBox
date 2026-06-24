/**
 * In-process OTP store for email verification.
 */

declare global {
  // eslint-disable-next-line no-var
  var __otpStore:
    | Map<
        string,
        {
          code: string;
          expiresAt: number;
          attempts: number;
        }
      >
    | undefined;
}

// Keep same Map during hot reloads
const store: Map<
  string,
  {
    code: string;
    expiresAt: number;
    attempts: number;
  }
> =
  globalThis.__otpStore ??
  (globalThis.__otpStore = new Map());

const MAX_ATTEMPTS = 5;

export type OTPCheckResult =
  | { valid: true; attemptsRemaining: number; maxAttempts: number }
  | {
      valid: false;
      reason: "missing" | "expired" | "invalid" | "locked";
      attemptsRemaining: number;
      maxAttempts: number;
    };

/** Save OTP */
export function saveOTP(email: string, code: string) {
  store.set(email.toLowerCase(), {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0,
  });
}

/** Validate OTP */
export function checkOTP(
  email: string,
  code: string
): OTPCheckResult {

  const normalizedEmail = email.toLowerCase();

  const entry = store.get(normalizedEmail);

  if (!entry) {
    return {
      valid: false,
      reason: "missing",
      attemptsRemaining: 0,
      maxAttempts: MAX_ATTEMPTS,
    };
  }

  // Expired
  if (Date.now() > entry.expiresAt) {
    store.delete(normalizedEmail);
    return {
      valid: false,
      reason: "expired",
      attemptsRemaining: 0,
      maxAttempts: MAX_ATTEMPTS,
    };
  }

  // Too many attempts
  if (entry.attempts >= MAX_ATTEMPTS) {
    store.delete(normalizedEmail);
    return {
      valid: false,
      reason: "locked",
      attemptsRemaining: 0,
      maxAttempts: MAX_ATTEMPTS,
    };
  }

  // Wrong code
  if (entry.code !== code) {
    entry.attempts++;
    const attemptsRemaining = Math.max(MAX_ATTEMPTS - entry.attempts, 0);

    if (attemptsRemaining === 0) {
      store.delete(normalizedEmail);
      return {
        valid: false,
        reason: "locked",
        attemptsRemaining,
        maxAttempts: MAX_ATTEMPTS,
      };
    }

    return {
      valid: false,
      reason: "invalid",
      attemptsRemaining,
      maxAttempts: MAX_ATTEMPTS,
    };
  }

  // Correct code
  store.delete(normalizedEmail);

  return {
    valid: true,
    attemptsRemaining: MAX_ATTEMPTS - entry.attempts,
    maxAttempts: MAX_ATTEMPTS,
  };
}

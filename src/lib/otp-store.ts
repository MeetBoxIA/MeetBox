/**
 * Persistent OTP store for email verification, backed by Supabase.
 *
 * Previously an in-process Map — same serverless-instance problem as
 * reset-token-store.ts (see supabase/otp_codes_migration.sql).
 */
import { getSupabase } from "./supabase";

const TTL_MS = 10 * 60 * 1000; // 10 minutes
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
export async function saveOTP(email: string, code: string): Promise<void> {
  const db = getSupabase();
  await db.from("otp_codes").upsert({
    email: email.toLowerCase(),
    code,
    expires_at: new Date(Date.now() + TTL_MS).toISOString(),
    attempts: 0,
  });
}

/** Validate OTP */
export async function checkOTP(email: string, code: string): Promise<OTPCheckResult> {
  const normalizedEmail = email.toLowerCase();
  const db = getSupabase();

  const { data: entry } = await db
    .from("otp_codes")
    .select("code, expires_at, attempts")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (!entry) {
    return { valid: false, reason: "missing", attemptsRemaining: 0, maxAttempts: MAX_ATTEMPTS };
  }

  // Expired
  if (new Date(entry.expires_at).getTime() < Date.now()) {
    await db.from("otp_codes").delete().eq("email", normalizedEmail);
    return { valid: false, reason: "expired", attemptsRemaining: 0, maxAttempts: MAX_ATTEMPTS };
  }

  // Too many attempts
  if (entry.attempts >= MAX_ATTEMPTS) {
    await db.from("otp_codes").delete().eq("email", normalizedEmail);
    return { valid: false, reason: "locked", attemptsRemaining: 0, maxAttempts: MAX_ATTEMPTS };
  }

  // Wrong code
  if (entry.code !== code) {
    const attempts = entry.attempts + 1;
    const attemptsRemaining = Math.max(MAX_ATTEMPTS - attempts, 0);

    if (attemptsRemaining === 0) {
      await db.from("otp_codes").delete().eq("email", normalizedEmail);
      return { valid: false, reason: "locked", attemptsRemaining, maxAttempts: MAX_ATTEMPTS };
    }

    await db.from("otp_codes").update({ attempts }).eq("email", normalizedEmail);
    return { valid: false, reason: "invalid", attemptsRemaining, maxAttempts: MAX_ATTEMPTS };
  }

  // Correct code
  await db.from("otp_codes").delete().eq("email", normalizedEmail);

  return {
    valid: true,
    attemptsRemaining: MAX_ATTEMPTS - entry.attempts,
    maxAttempts: MAX_ATTEMPTS,
  };
}

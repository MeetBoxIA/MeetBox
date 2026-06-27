/**
 * Persistent store for password-reset tokens, backed by Supabase.
 *
 * Previously an in-process Map — but on serverless deployments the request
 * that saves the token and the request that validates it can land on
 * different instances, making valid links randomly fail. Persisting in the
 * `password_reset_tokens` table (see supabase/password_reset_tokens_migration.sql)
 * fixes this while keeping the exact same function signatures as before.
 */
import { getSupabase } from "./supabase";

const TTL_MS = 30 * 60 * 1000; // 30 minutes

/** Save a reset token for the given email (overwrites any previous token). */
export async function saveResetToken(email: string, token: string): Promise<void> {
  const db = getSupabase();
  await db.from("password_reset_tokens").upsert({
    email: email.toLowerCase(),
    token,
    expires_at: new Date(Date.now() + TTL_MS).toISOString(),
    used: false,
  });
}

export type TokenCheckResult =
  | { valid: true }
  | { valid: false; reason: "missing" | "expired" | "used" | "invalid" };

/** Validate a reset token. Does NOT consume it — call consumeResetToken on success. */
export async function checkResetToken(email: string, token: string): Promise<TokenCheckResult> {
  const db = getSupabase();
  const { data: entry } = await db
    .from("password_reset_tokens")
    .select("token, expires_at, used")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (!entry) return { valid: false, reason: "missing" };
  if (entry.used) return { valid: false, reason: "used" };
  if (new Date(entry.expires_at).getTime() < Date.now()) return { valid: false, reason: "expired" };
  if (entry.token !== token) return { valid: false, reason: "invalid" };
  return { valid: true };
}

/** Mark the token as used so it cannot be replayed. */
export async function consumeResetToken(email: string): Promise<void> {
  const db = getSupabase();
  await db.from("password_reset_tokens").delete().eq("email", email.toLowerCase());
}

// ─────────────────────────────────────────────────────────────────────────────
// Desktop bearer-token authentication.
//
// Replaces the earlier stateless AES code with stateful, revocable sessions.
// The raw token is shown to the user exactly once (when minted) and only its
// SHA-256 hash is stored, so a database leak never exposes usable tokens.
//
// Token lifecycle:
//   mint    → web app creates a session, returns the raw token to the desktop
//   validate→ every desktop request sends `Authorization: Bearer <token>`
//   rotate  → issue a new token, revoke the old one (chained via rotated_from)
//   revoke  → mark a session revoked; future requests with it are rejected
//
// Tokens expire after DEFAULT_TTL_DAYS unless rotated.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash, randomBytes } from "crypto";
import { getSupabase } from "./supabase";

const DEFAULT_TTL_DAYS = 90;
const TOKEN_PREFIX     = "mbox_live_";

export interface MintedToken {
  raw:        string;   // returned to client ONCE — never stored
  sessionId:  string;
  prefix:     string;
  expiresAt:  string;
}

export interface ValidatedSession {
  sessionId: string;
  userId:    string;
}

/** SHA-256 of the raw token — what we actually store and look up by. */
function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Generate a cryptographically-random raw token. */
function generateRaw(): string {
  return TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

/**
 * Mint a new desktop session for a user and return the raw token.
 * @param meta optional device fingerprint for display in the web UI.
 */
export async function mintDesktopToken(
  userId: string,
  meta: { device_label?: string; platform?: string; app_version?: string } = {},
  ttlDays = DEFAULT_TTL_DAYS,
): Promise<MintedToken | null> {
  const raw       = generateRaw();
  const tokenHash = hashToken(raw);
  const prefix    = raw.slice(0, 12);
  const expiresAt = new Date(Date.now() + ttlDays * 86400_000).toISOString();

  const { data, error } = await getSupabase()
    .from("desktop_sessions")
    .insert({
      user_id:      userId,
      token_hash:   tokenHash,
      token_prefix: prefix,
      device_label: meta.device_label ?? null,
      platform:     meta.platform ?? null,
      app_version:  meta.app_version ?? null,
      expires_at:   expiresAt,
    })
    .select("id")
    .single();

  if (error || !data) return null;
  return { raw, sessionId: data.id, prefix, expiresAt };
}

/**
 * Validate a raw bearer token. Returns the owning user + session if the token
 * exists, is not revoked, and has not expired. Updates last_used_at.
 */
export async function validateDesktopToken(raw: string): Promise<ValidatedSession | null> {
  if (!raw || !raw.startsWith(TOKEN_PREFIX)) return null;
  const db = getSupabase();

  const { data: sessionRow } = await db
    .from("desktop_sessions")
    .select("id, user_id, expires_at, revoked_at")
    .eq("token_hash", hashToken(raw))
    .maybeSingle();

  if (!sessionRow) return null;
  if (sessionRow.revoked_at) return null;
  if (new Date(sessionRow.expires_at).getTime() < Date.now()) return null;

  // Best-effort touch — don't block the request on it.
  db.from("desktop_sessions")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", sessionRow.id)
    .then(() => { /* fire and forget */ });

  return { sessionId: sessionRow.id, userId: sessionRow.user_id };
}

/**
 * Rotate a session: mint a fresh token and revoke the old one, chaining the
 * lineage via rotated_from so the audit trail is preserved.
 */
export async function rotateDesktopToken(oldSessionId: string, userId: string): Promise<MintedToken | null> {
  const db = getSupabase();

  // Verify the old session belongs to the user before rotating.
  const { data: existing } = await db
    .from("desktop_sessions")
    .select("id, device_label, platform, app_version")
    .eq("id", oldSessionId).eq("user_id", userId)
    .maybeSingle();
  if (!existing) return null;

  const raw       = generateRaw();
  const expiresAt = new Date(Date.now() + DEFAULT_TTL_DAYS * 86400_000).toISOString();

  const { data: newRow, error } = await db
    .from("desktop_sessions")
    .insert({
      user_id:      userId,
      token_hash:   hashToken(raw),
      token_prefix: raw.slice(0, 12),
      device_label: existing.device_label,
      platform:     existing.platform,
      app_version:  existing.app_version,
      expires_at:   expiresAt,
      rotated_from: oldSessionId,
    })
    .select("id").single();

  if (error || !newRow) return null;

  // Revoke the old token now that the new one exists.
  await db.from("desktop_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", oldSessionId);

  return { raw, sessionId: newRow.id, prefix: raw.slice(0, 12), expiresAt };
}

/** Revoke a single session (logout from one device). */
export async function revokeDesktopToken(sessionId: string, userId: string): Promise<boolean> {
  const { error } = await getSupabase()
    .from("desktop_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", sessionId).eq("user_id", userId);
  return !error;
}

/** Revoke ALL active sessions for a user (logout everywhere). */
export async function revokeAllDesktopTokens(userId: string): Promise<boolean> {
  const { error } = await getSupabase()
    .from("desktop_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId).is("revoked_at", null);
  return !error;
}

/**
 * Extract and validate the bearer token from a request's Authorization header.
 * Returns the validated session or null. Use at the top of every /api/desktop route.
 */
export async function authenticateDesktopRequest(req: Request): Promise<ValidatedSession | null> {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const raw = header.slice(7).trim();
  return validateDesktopToken(raw);
}

/**
 * GET  /api/auth/desktop/token  — return the current user's desktop token
 * DELETE /api/auth/desktop/token — (no-op) token cannot be revoked without
 *                                   changing AUTH_SECRET; returns same token
 *                                   with an informational message.
 *
 * Stateless token design: AES-128-ECB(userId_bytes, key)
 * No DB table needed. The token encodes the userId; /connect decrypts it
 * and does a lookup by ID.
 * Format: MBOX-{32 hex chars} = "MBOX-" + AES(16-byte UUID) as uppercase hex.
 *
 * Because the token is deterministic (same userId + same key = same token),
 * the only way to revoke access is to rotate AUTH_SECRET, which invalidates
 * all existing sessions and tokens simultaneously.
 */
import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";
import { createHash, createCipheriv } from "crypto";

/** Derive the 16-byte AES key from AUTH_SECRET via SHA-256. */
function aesKey(): Buffer {
  return createHash("sha256").update(process.env.AUTH_SECRET ?? "fallback").digest().subarray(0, 16);
}

/**
 * Encrypt a UUID into a MBOX-{32hex} token.
 * AES-128-ECB on a single 16-byte block — ECB is safe here because we
 * always encrypt exactly one block, so there are no repeating patterns.
 */
function encryptUserId(userId: string): string {
  const key       = aesKey();
  const plaintext = Buffer.from(userId.replace(/-/g, ""), "hex"); // UUID → 16 raw bytes
  const cipher    = createCipheriv("aes-128-ecb", key, null);
  cipher.setAutoPadding(false);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return "MBOX-" + encrypted.toString("hex").toUpperCase();
}

/** Look up the Supabase UUID for the signed-in user's email. */
async function resolveUserId(email: string): Promise<string | null> {
  const { data } = await getSupabase().from("users").select("id").eq("email", email).single();
  return data?.id ?? null;
}

/** GET — return the deterministic desktop token for the authenticated user. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({ token: encryptUserId(userId) });
}

/**
 * DELETE — the token is deterministic, so "revoking" it would require
 * rotating AUTH_SECRET (which would also invalidate all web sessions).
 * We return the same token with an informational note rather than silently
 * doing nothing.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({ token: encryptUserId(userId) });
}

/**
 * POST /api/auth/desktop/connect
 *
 * Validates a MBOX-{32hex} token produced by the /token endpoint,
 * decrypts the embedded userId with AES-128-ECB, and returns the
 * matching user's public profile.
 *
 * Used by the Electron app's ConnectScreen to link the desktop client
 * to a web account without requiring a browser OAuth flow.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { createHash, createDecipheriv } from "crypto";
import { mintDesktopToken } from "@/lib/desktop-auth";

// Electron renders from file:// or localhost:5173 (dev). Chromium enforces
// CORS, so we must include these headers on EVERY response — including errors.
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** Derive the 16-byte AES key from AUTH_SECRET via SHA-256. */
function aesKey(): Buffer {
  return createHash("sha256").update(process.env.AUTH_SECRET ?? "fallback").digest().subarray(0, 16);
}

/**
 * Decrypt a MBOX-{32hex} token back to a UUID string.
 * AES-128-ECB is safe here because we always encrypt exactly one 16-byte
 * block (the UUID bytes), eliminating the pattern-exposure risk that makes
 * ECB unsafe for multi-block data.
 *
 * @returns The UUID string, or null if the token is malformed/wrong key.
 */
function decryptToken(token: string): string | null {
  try {
    const hex = token.slice(5); // strip "MBOX-" prefix
    if (hex.length !== 32) return null;
    const decipher = createDecipheriv("aes-128-ecb", aesKey(), null);
    decipher.setAutoPadding(false);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(hex, "hex")), decipher.final()]);
    const h = decrypted.toString("hex");
    // Reassemble UUID with hyphens from the raw 32-char hex
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  } catch {
    return null;
  }
}

/** Handle CORS preflight from the Electron renderer. */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** POST — validate the code, decrypt the userId, return the user profile. */
export async function POST(req: NextRequest) {
  const body  = await req.json().catch(() => ({}));
  const token = String(body.token ?? "").trim().toUpperCase();
  // Optional device fingerprint sent by the desktop client for the sessions list.
  const deviceMeta = {
    device_label: typeof body.device_label === "string" ? body.device_label : undefined,
    platform:     typeof body.platform === "string" ? body.platform : undefined,
    app_version:  typeof body.app_version === "string" ? body.app_version : undefined,
  };

  if (!/^MBOX-[0-9A-F]{32}$/.test(token)) {
    return NextResponse.json(
      { error: "Invalid code. Make sure you copied it completely from Integrations." },
      { status: 400, headers: CORS },
    );
  }

  const userId = decryptToken(token);
  if (!userId) {
    return NextResponse.json(
      { error: "Invalid code or generated with a different key." },
      { status: 400, headers: CORS },
    );
  }

  const { data: user, error } = await getSupabase()
    .from("users")
    .select("id, name, email, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  if (error || !user) {
    return NextResponse.json(
      { error: "User not found. Generate the code again from Integrations." },
      { status: 404, headers: CORS },
    );
  }

  // Mint a long-lived, revocable bearer token for the desktop session. The
  // short MBOX code is only an exchange credential; this token authenticates
  // every subsequent /api/desktop/* request (uploads, job polling, etc.).
  const minted = await mintDesktopToken(user.id, deviceMeta);

  return NextResponse.json(
    {
      user:         { id: user.id, name: user.name, email: user.email, avatar: user.avatar_url ?? null },
      access_token: minted?.raw ?? null,        // store and send as `Authorization: Bearer`
      expires_at:   minted?.expiresAt ?? null,
      session_id:   minted?.sessionId ?? null,
    },
    { headers: CORS },
  );
}

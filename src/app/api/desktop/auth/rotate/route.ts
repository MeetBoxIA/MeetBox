/**
 * POST /api/desktop/auth/rotate
 * Rotates the calling desktop session: issues a fresh token and revokes the
 * current one. Returns the new raw token (shown once). The desktop client must
 * replace its stored token with the new value.
 *
 * Auth: Bearer desktop token (the one being rotated).
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateDesktopRequest, rotateDesktopToken } from "@/lib/desktop-auth";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateDesktopRequest(req);
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401, headers: CORS });

  const minted = await rotateDesktopToken(auth.sessionId, auth.userId);
  if (!minted) return NextResponse.json({ error: "No se pudo rotar el token" }, { status: 500, headers: CORS });

  return NextResponse.json({
    token:      minted.raw,
    prefix:     minted.prefix,
    expires_at: minted.expiresAt,
  }, { headers: CORS });
}

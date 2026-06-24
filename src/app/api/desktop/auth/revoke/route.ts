/**
 * POST /api/desktop/auth/revoke
 * Revokes desktop session(s). Two modes:
 *   - Bearer desktop token  → revokes that session (desktop self-logout)
 *   - Web session + body { all: true } → revokes ALL the user's sessions
 *   - Web session + body { session_id } → revokes a specific session
 *
 * This lets the user disconnect a device from the web Integrations page or the
 * desktop app revoke itself.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth as webAuth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";
import {
  authenticateDesktopRequest, revokeDesktopToken, revokeAllDesktopTokens,
} from "@/lib/desktop-auth";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // ── Mode A: desktop self-revoke via bearer token ─────────────────────────
  const desktopAuth = await authenticateDesktopRequest(req);
  if (desktopAuth) {
    const ok = await revokeDesktopToken(desktopAuth.sessionId, desktopAuth.userId);
    return NextResponse.json({ revoked: ok }, { status: ok ? 200 : 500, headers: CORS });
  }

  // ── Mode B: web session revoking its devices ─────────────────────────────
  const session = await webAuth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401, headers: CORS });

  const { data: u } = await getSupabase().from("users").select("id").eq("email", session.user.email).single();
  if (!u) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404, headers: CORS });

  if (body.all === true) {
    const ok = await revokeAllDesktopTokens(u.id);
    return NextResponse.json({ revoked_all: ok }, { headers: CORS });
  }
  if (typeof body.session_id === "string") {
    const ok = await revokeDesktopToken(body.session_id, u.id);
    return NextResponse.json({ revoked: ok }, { headers: CORS });
  }

  return NextResponse.json({ error: "Especifica session_id o all:true" }, { status: 400, headers: CORS });
}

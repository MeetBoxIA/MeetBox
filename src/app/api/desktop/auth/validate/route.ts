/**
 * GET /api/desktop/auth/validate
 * Lightweight check the desktop client calls on startup to confirm its stored
 * token is still valid (not expired / revoked). Returns the owning user.
 *
 * Auth: Bearer desktop token.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateDesktopRequest } from "@/lib/desktop-auth";
import { getSupabase } from "@/lib/supabase";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const auth = await authenticateDesktopRequest(req);
  if (!auth) return NextResponse.json({ valid: false }, { status: 401, headers: CORS });

  const { data: user } = await getSupabase()
    .from("users").select("id, name, email, avatar_url").eq("id", auth.userId).single();

  return NextResponse.json({
    valid: true,
    user: user ? { id: user.id, name: user.name, email: user.email, avatar: user.avatar_url ?? null } : null,
  }, { headers: CORS });
}

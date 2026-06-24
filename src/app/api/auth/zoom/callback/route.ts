import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

/**
 * GET /api/auth/zoom/callback
 * Intercambia el código de autorización por tokens y los persiste en la BD.
 */
export async function GET(req: NextRequest) {
  const code  = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  const base        = (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const callbackUri  = `${base}/api/auth/zoom/callback`;
  const dashboardUrl = `${base}/dashboard?zoom=connected`;
  const deniedUrl    = `${base}/dashboard?zoom=denied`;
  const errorUrl     = `${base}/dashboard?zoom=error`;

  if (error || !code) return NextResponse.redirect(deniedUrl);

  const session = await auth();
  if (!session?.user?.email) return NextResponse.redirect(new URL("/auth", req.url));

  // ── Intercambio de código por tokens ─────────────────────────────────────
  // Zoom requiere Basic Auth (client_id:client_secret en Base64)
  const credentials = Buffer.from(
    `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`,
  ).toString("base64");

  const tokenRes = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization:  `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type:   "authorization_code",
      code,
      redirect_uri: "http://localhost:3000/api/auth/zoom/callback",
    }),
  });

  if (!tokenRes.ok) {
    console.error("Zoom token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(errorUrl);
  }

  const tokens = await tokenRes.json() as {
    access_token:  string;
    refresh_token: string;
    expires_in:    number;
    scope:         string;
  };

  // ── Obtener datos del usuario Zoom ────────────────────────────────────────
  const meRes = await fetch("https://api.zoom.us/v2/users/me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  let zoomUserId: string | null = null;
  let zoomEmail:  string | null = null;

  if (meRes.ok) {
    const me = await meRes.json() as { id: string; email: string };
    zoomUserId = me.id   ?? null;
    zoomEmail  = me.email ?? null;
  }

  // ── Persistir en la tabla users ───────────────────────────────────────────
  const { error: dbError } = await getSupabase()
    .from("users")
    .update({
      zoom_access_token:  tokens.access_token,
      zoom_refresh_token: tokens.refresh_token ?? null,
      zoom_token_expiry:  new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      zoom_user_id:       zoomUserId,
      zoom_email:         zoomEmail,
    })
    .eq("email", session.user.email);

  if (dbError) {
    console.error("Failed to save Zoom tokens:", dbError.message);
    return NextResponse.redirect(errorUrl);
  }

  return NextResponse.redirect(dashboardUrl);
}

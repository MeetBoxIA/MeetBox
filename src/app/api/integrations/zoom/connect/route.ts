/**
 * GET /api/integrations/zoom/connect
 * Starts the Zoom OAuth flow: requires a web session, then redirects the
 * browser to Zoom's authorize screen with a signed CSRF state.
 */
import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";
import { buildAuthorizeUrl, zoomConfigured, appBaseUrl } from "@/lib/integrations/zoom";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.redirect(`${appBaseUrl()}/auth`);
  }

  if (!zoomConfigured()) {
    return NextResponse.redirect(`${appBaseUrl()}/dashboard?zoom=missing_credentials`);
  }

  const { data: u } = await getSupabase()
    .from("users").select("id").eq("email", session.user.email).single();
  if (!u) return NextResponse.redirect(`${appBaseUrl()}/auth`);

  return NextResponse.redirect(buildAuthorizeUrl(u.id));
}

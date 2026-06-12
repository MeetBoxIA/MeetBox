/**
 * GET /api/integrations/slack/connect
 * Starts the Slack OAuth flow: requires a web session, then redirects the
 * browser to Slack's authorize screen with a signed CSRF state.
 */
import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";
import { buildAuthorizeUrl, slackConfigured, appBaseUrl } from "@/lib/integrations/slack";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.redirect(`${appBaseUrl()}/auth`);
  }

  if (!slackConfigured()) {
    // Credentials missing — bounce back to the dashboard with a clear flag.
    return NextResponse.redirect(`${appBaseUrl()}/dashboard?slack=missing_credentials`);
  }

  const { data: u } = await getSupabase()
    .from("users").select("id").eq("email", session.user.email).single();
  if (!u) return NextResponse.redirect(`${appBaseUrl()}/auth`);

  return NextResponse.redirect(buildAuthorizeUrl(u.id));
}

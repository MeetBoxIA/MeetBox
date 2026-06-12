import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

/**
 * GET /api/auth/jira/callback
 *
 * OAuth2 callback for Jira. Exchanges the authorization code for tokens,
 * fetches the user's cloud ID / site URL, and persists everything.
 * Mirrors /api/auth/google-calendar/callback/route.ts.
 */
export async function GET(req: NextRequest) {
  const code  = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  const callbackUri   = new URL("/api/auth/jira/callback", req.url).toString();
  const dashboardUrl  = new URL("/dashboard?jira=connected", req.url).toString();
  const deniedUrl     = new URL("/dashboard?jira=denied",    req.url).toString();
  const errorUrl      = new URL("/dashboard?jira=error",     req.url).toString();

  if (error || !code) {
    return NextResponse.redirect(deniedUrl);
  }

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL("/auth", req.url));
  }

  // ── Step 1: Exchange authorization code for tokens ──────────────────────
  const tokenRes = await fetch("https://auth.atlassian.com/oauth/token", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type:    "authorization_code",
      client_id:     process.env.JIRA_CLIENT_ID!,
      client_secret: process.env.JIRA_CLIENT_SECRET!,
      code,
      redirect_uri:  callbackUri,
    }),
  });

  if (!tokenRes.ok) {
    console.error("Jira token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(errorUrl);
  }

  const tokens = await tokenRes.json() as {
    access_token:   string;
    refresh_token?: string;
    expires_in?:    number;
    scope?:         string;
  };

  // ── Step 2: Fetch accessible resources to get cloud_id & site URL ──────
  const resourcesRes = await fetch(
    "https://api.atlassian.com/oauth/token/accessible-resources",
    { headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: "application/json" } },
  );

  if (!resourcesRes.ok) {
    console.error("Jira accessible-resources failed:", await resourcesRes.text());
    return NextResponse.redirect(errorUrl);
  }

  const resources = await resourcesRes.json() as {
    id:    string;
    url:   string;
    name:  string;
    scopes: string[];
  }[];

  if (resources.length === 0) {
    console.error("Jira: no accessible resources found for user");
    return NextResponse.redirect(errorUrl);
  }

  // Use the first accessible Jira site
  const site = resources[0];

  // ── Step 3: Persist tokens + cloud info to the users table ─────────────
  const { error: dbError } = await getSupabase()
    .from("users")
    .update({
      jira_access_token:  tokens.access_token,
      jira_refresh_token: tokens.refresh_token ?? null,
      jira_token_expiry:  tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null,
      jira_cloud_id:      site.id,
      jira_site_url:      site.url,
    })
    .eq("email", session.user.email);

  if (dbError) {
    console.error("Failed to save Jira tokens:", dbError.message);
    return NextResponse.redirect(errorUrl);
  }

  return NextResponse.redirect(dashboardUrl);
}

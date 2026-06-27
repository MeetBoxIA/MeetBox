/**
 * GET /api/auth/notion/callback
 *
 * OAuth2 callback for Notion. Exchanges the authorization code for an access
 * token and persists the credentials to the user's row in Supabase.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const code  = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  const dashboardUrl = new URL("/dashboard?notion=connected",  req.url).toString();
  const deniedUrl    = new URL("/dashboard?notion=denied",     req.url).toString();
  const errorUrl     = new URL("/dashboard?notion=error",      req.url).toString();

  if (error || !code) return NextResponse.redirect(deniedUrl);

  const session = await auth();
  if (!session?.user?.email) return NextResponse.redirect(new URL("/auth", req.url));

  const redirectUri = process.env.NOTION_REDIRECT_URI
    ?? new URL("/api/auth/notion/callback", req.url).toString();

  // Exchange code for access_token using HTTP Basic Auth (client_id:client_secret).
  const credentials = Buffer.from(
    `${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`,
  ).toString("base64");

  const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization:  `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type:   "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    console.error("Notion token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(errorUrl);
  }

  const tokens = await tokenRes.json() as {
    access_token:    string;
    workspace_id:    string;
    workspace_name:  string;
    bot_id:          string;
    token_type:      string;
  };

  const { error: dbError } = await getSupabase()
    .from("users")
    .update({
      notion_access_token:   tokens.access_token,
      notion_workspace_id:   tokens.workspace_id,
      notion_workspace_name: tokens.workspace_name ?? null,
      notion_bot_id:         tokens.bot_id,
    })
    .eq("email", session.user.email);

  if (dbError) {
    console.error("Failed to save Notion tokens:", dbError.message);
    return NextResponse.redirect(errorUrl);
  }

  return NextResponse.redirect(dashboardUrl);
}

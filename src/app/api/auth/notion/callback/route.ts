import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

/**
 * GET /api/auth/notion/callback
 *
 * OAuth2 callback for Notion. Exchanges the authorization code for tokens,
 * and persists the workspace info to the database.
 */
export async function GET(req: NextRequest) {
  const code  = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  const callbackUri   = new URL("/api/auth/notion/callback", req.url).toString();
  const dashboardUrl  = new URL("/dashboard?notion=connected", req.url).toString();
  const deniedUrl     = new URL("/dashboard?notion=denied",    req.url).toString();
  const errorUrl      = new URL("/dashboard?notion=error",     req.url).toString();

  if (error || !code) {
    return NextResponse.redirect(deniedUrl);
  }

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL("/auth", req.url));
  }

  // 1. Exchange authorization code for token
  const clientId = process.env.NOTION_CLIENT_ID || "";
  const clientSecret = process.env.NOTION_CLIENT_SECRET || "";
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  
  const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUri,
    }),
  });

  if (!tokenRes.ok) {
    console.error("Notion token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(errorUrl);
  }

  const tokens = await tokenRes.json() as {
    access_token: string;
    workspace_id: string;
    workspace_name: string;
    bot_id: string;
  };

  // 2. Persist tokens + workspace info
  const { error: dbError } = await getSupabase()
    .from("users")
    .update({
      notion_access_token:   tokens.access_token,
      notion_workspace_id:   tokens.workspace_id,
      notion_workspace_name: tokens.workspace_name,
      notion_bot_id:         tokens.bot_id,
    })
    .eq("email", session.user.email);

  if (dbError) {
    console.error("Failed to save Notion tokens:", dbError.message);
    return NextResponse.redirect(errorUrl);
  }

  return NextResponse.redirect(dashboardUrl);
}

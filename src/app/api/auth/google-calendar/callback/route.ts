import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const code  = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  const callbackUri   = new URL("/api/auth/google-calendar/callback", req.url).toString();
  const dashboardUrl  = new URL("/dashboard?gcal=connected", req.url).toString();
  const deniedUrl     = new URL("/dashboard?gcal=denied",    req.url).toString();
  const errorUrl      = new URL("/dashboard?gcal=error",     req.url).toString();

  if (error || !code) {
    return NextResponse.redirect(deniedUrl);
  }

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL("/auth", req.url));
  }

  // Exchange authorization code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  callbackUri,
      grant_type:    "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    console.error("Google token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(errorUrl);
  }

  const tokens = await tokenRes.json() as {
    access_token:   string;
    refresh_token?: string;
    expires_in?:    number;
  };

  const { error: dbError } = await getSupabase()
    .from("users")
    .update({
      google_access_token:  tokens.access_token,
      google_refresh_token: tokens.refresh_token ?? null,
      google_token_expiry:  tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null,
    })
    .eq("email", session.user.email);

  if (dbError) {
    console.error("Failed to save Google tokens:", dbError.message);
    return NextResponse.redirect(errorUrl);
  }

  return NextResponse.redirect(dashboardUrl);
}

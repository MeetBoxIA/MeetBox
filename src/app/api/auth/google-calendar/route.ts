import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL("/auth", req.url));
  }

  // Derive the callback URI from the incoming request origin — no NEXTAUTH_URL needed
  const callbackUri = new URL("/api/auth/google-calendar/callback", req.url).toString();

  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID!,
    redirect_uri:  callbackUri,
    scope:         "https://www.googleapis.com/auth/calendar",
    response_type: "code",
    access_type:   "offline",
    prompt:        "consent",
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
}

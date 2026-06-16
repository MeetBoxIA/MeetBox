import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";

/**
 * GET /api/auth/notion
 *
 * Initiates the Notion OAuth2 flow by redirecting the user to Notion's
 * authorization endpoint.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL("/auth", req.url));
  }

  const callbackUri = new URL("/api/auth/notion/callback", req.url).toString();

  const params = new URLSearchParams({
    client_id:     process.env.NOTION_CLIENT_ID!,
    response_type: "code",
    owner:         "user",
    redirect_uri:  callbackUri,
    state:         session.user.email,
  });

  return NextResponse.redirect(
    `https://api.notion.com/v1/oauth/authorize?${params.toString()}`,
  );
}

/**
 * GET /api/auth/notion
 *
 * Initiates the Notion OAuth2 flow. Redirects to Notion's authorization
 * endpoint. The integration must be configured as a "Public Integration" in
 * https://www.notion.so/my-integrations with NOTION_CLIENT_ID,
 * NOTION_CLIENT_SECRET, and NOTION_REDIRECT_URI set in env.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL("/auth", req.url));
  }

  const redirectUri = process.env.NOTION_REDIRECT_URI
    ?? new URL("/api/auth/notion/callback", req.url).toString();

  const params = new URLSearchParams({
    client_id:     process.env.NOTION_CLIENT_ID!,
    redirect_uri:  redirectUri,
    response_type: "code",
    owner:         "user",
    state:         session.user.email,
  });

  return NextResponse.redirect(
    `https://api.notion.com/v1/oauth/authorize?${params.toString()}`,
  );
}

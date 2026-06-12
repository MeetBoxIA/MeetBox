import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";

/**
 * GET /api/auth/jira
 *
 * Initiates the Jira OAuth2 flow by redirecting the user to Atlassian's
 * authorization endpoint. Mirrors the Google Calendar OAuth init pattern
 * in /api/auth/google-calendar/route.ts.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL("/auth", req.url));
  }

  const callbackUri = new URL("/api/auth/jira/callback", req.url).toString();

  // Atlassian OAuth 2.0 (3LO) authorization URL
  // Scopes: read/write Jira work items, read users, manage projects & config
  const params = new URLSearchParams({
    audience:      "api.atlassian.com",
    client_id:     process.env.JIRA_CLIENT_ID!,
    scope:         [
      "read:jira-work",
      "write:jira-work",
      "read:jira-user",
      "manage:jira-project",
      "manage:jira-configuration",
      "offline_access",            // required for refresh tokens
    ].join(" "),
    redirect_uri:  callbackUri,
    // state could carry CSRF protection; for now we rely on session auth
    state:         session.user.email,
    response_type: "code",
    prompt:        "consent",
  });

  return NextResponse.redirect(
    `https://auth.atlassian.com/authorize?${params.toString()}`,
  );
}

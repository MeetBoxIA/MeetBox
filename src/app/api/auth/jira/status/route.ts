import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

/**
 * GET /api/auth/jira/status
 *
 * Returns whether the current user has an active Jira connection.
 * Used by the frontend IntegrationsView to show connection state.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ connected: false }, { status: 401 });
  }

  const { data } = await getSupabase()
    .from("users")
    .select("jira_access_token, jira_site_url, jira_cloud_id")
    .eq("email", session.user.email)
    .single();

  if (!data?.jira_access_token) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    site_url:  data.jira_site_url ?? null,
    cloud_id:  data.jira_cloud_id ?? null,
  });
}

/**
 * DELETE /api/auth/jira/status
 *
 * Disconnects the user's Jira account by clearing all Jira-related tokens.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { error } = await getSupabase()
    .from("users")
    .update({
      jira_access_token:  null,
      jira_refresh_token: null,
      jira_token_expiry:  null,
      jira_cloud_id:      null,
      jira_site_url:      null,
    })
    .eq("email", session.user.email);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ disconnected: true });
}

/**
 * GET /api/integrations/slack/callback
 * Slack redirects here after the user authorizes (or cancels).
 * Validates the signed state, exchanges the code for a bot token, stores it
 * encrypted, marks 'slack' as connected in the user's profile (so the
 * Integrations card lights up), and returns to the dashboard.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { verifyState, exchangeCode, saveSlackConnection, appBaseUrl } from "@/lib/integrations/slack";

function backToDashboard(flag: string): NextResponse {
  return NextResponse.redirect(`${appBaseUrl()}/dashboard?slack=${flag}`);
}

export async function GET(req: NextRequest) {
  const url   = new URL(req.url);
  const code  = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // User pressed "Cancel" on Slack's screen
  if (error) return backToDashboard("cancelled");
  if (!code || !state) return backToDashboard("invalid");

  // CSRF check — state must be one we signed, unexpired
  const userId = verifyState(state);
  if (!userId) return backToDashboard("invalid_state");

  const oauth = await exchangeCode(code);
  if (!oauth.ok || !oauth.access_token) {
    console.error("Slack OAuth exchange failed:", oauth.error);
    return backToDashboard("exchange_failed");
  }

  await saveSlackConnection(userId, oauth);

  // Reflect the connection in user_profiles.integrations so the existing
  // Integrations UI shows the card as connected.
  const db = getSupabase();
  const { data: profile } = await db
    .from("user_profiles").select("integrations").eq("user_id", userId).maybeSingle();
  const current: string[] = (profile?.integrations as string[] | null) ?? [];
  if (!current.includes("slack")) {
    await db.from("user_profiles")
      .update({ integrations: [...current, "slack"] })
      .eq("user_id", userId);
  }

  return backToDashboard("connected");
}

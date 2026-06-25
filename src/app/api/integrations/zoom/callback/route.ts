/**
 * GET /api/integrations/zoom/callback
 * Zoom redirects here after the user authorizes (or cancels).
 * Validates the signed state, exchanges the code for tokens, stores them
 * encrypted, marks 'zoom' as connected in the user's profile.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { verifyState, exchangeCode, saveZoomConnection, appBaseUrl } from "@/lib/integrations/zoom";

function backToDashboard(flag: string): NextResponse {
  return NextResponse.redirect(`${appBaseUrl()}/dashboard?zoom=${flag}`);
}

export async function GET(req: NextRequest) {
  const url   = new URL(req.url);
  const code  = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) return backToDashboard("cancelled");
  if (!code || !state) return backToDashboard("invalid");

  const userId = verifyState(state);
  if (!userId) return backToDashboard("invalid_state");

  const token = await exchangeCode(code);
  if (token.error || !token.access_token) {
    console.error("Zoom OAuth exchange failed:", token.error, token.reason);
    return backToDashboard("exchange_failed");
  }

  await saveZoomConnection(userId, token);

  const db = getSupabase();
  const { data: profile } = await db
    .from("user_profiles").select("integrations").eq("user_id", userId).maybeSingle();
  const current: string[] = (profile?.integrations as string[] | null) ?? [];
  if (!current.includes("zoom")) {
    await db.from("user_profiles")
      .update({ integrations: [...current, "zoom"] })
      .eq("user_id", userId);
  }

  return backToDashboard("connected");
}

/**
 * /api/user/profile
 *
 * POST  — create or replace the user's onboarding profile (called once after signup wizard)
 * PATCH — partial update of profile fields (called from settings)
 * GET   — return the current profile (null if not yet completed)
 *
 * Uses upsert instead of insert/update to be idempotent — the profile may not
 * exist yet (user skipped onboarding) or may have been lost (e.g. DB migration).
 * A plain `update()` would silently do nothing when no row exists, so upsert
 * is the only safe choice here.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

/** POST — create or replace the full onboarding profile. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Resolve the real Supabase UUID via email rather than trusting session.user.id.
  // Tokens issued before the jwt callback fix may carry the OAuth sub instead of
  // the internal UUID, so we always look up by email to be safe.
  const { data: dbUser } = await getSupabase()
    .from("users")
    .select("id")
    .eq("email", session.user.email!)
    .single();

  if (!dbUser) {
    return NextResponse.json({ error: "User not found in database" }, { status: 404 });
  }

  const body = await req.json();
  const { orgName, teamSize, meetingTypes, tools, customTools } = body;

  if (!orgName || typeof orgName !== "string") {
    return NextResponse.json({ error: "orgName required" }, { status: 400 });
  }

  // Merge built-in tool choices and any free-text custom tool names
  const integrations: string[] = [
    ...(Array.isArray(tools)       ? tools       : []),
    ...(Array.isArray(customTools) ? customTools : []),
  ];

  const { error } = await getSupabase()
    .from("user_profiles")
    .upsert(
      {
        user_id:       dbUser.id,
        org_name:      orgName.trim(),
        team_size:     teamSize ?? null,
        meeting_types: Array.isArray(meetingTypes) ? meetingTypes : [],
        integrations,
        onboarded_at:  new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (error) {
    console.error("Error saving profile:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/** PATCH — apply a partial update to whichever profile fields are provided. */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: dbUser } = await getSupabase()
    .from("users")
    .select("id")
    .eq("email", session.user.email)
    .single();

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json();
  const patch: Record<string, unknown> = {};

  if (body.orgName      !== undefined) patch.org_name      = String(body.orgName).trim();
  if (body.teamSize     !== undefined) patch.team_size     = body.teamSize;
  if (body.meetingTypes !== undefined) patch.meeting_types = Array.isArray(body.meetingTypes) ? body.meetingTypes : [];
  if (body.integrations !== undefined) patch.integrations  = Array.isArray(body.integrations) ? body.integrations : [];

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  }

  // Upsert so the row is created if the user hasn't completed onboarding yet
  // (or if their profile row was lost). A plain update() silently does nothing
  // when no row matches, which would surface as "saved" in the UI but persist nothing.
  const { error } = await getSupabase()
    .from("user_profiles")
    .upsert(
      { user_id: dbUser.id, ...patch },
      { onConflict: "user_id" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/** GET — return the user's profile, or null if not yet created. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: dbUser } = await getSupabase()
    .from("users")
    .select("id")
    .eq("email", session.user.email)
    .single();

  if (!dbUser) {
    return NextResponse.json({ profile: null });
  }

  const { data, error } = await getSupabase()
    .from("user_profiles")
    .select("*")
    .eq("user_id", dbUser.id)
    .single();

  // PGRST116 = "no rows returned" — not an error, just means profile is missing
  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data ?? null });
}

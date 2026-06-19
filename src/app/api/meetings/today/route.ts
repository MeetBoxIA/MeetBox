/**
 * GET /api/meetings/today
 *
 * Returns today's meetings (type="meeting") for the authenticated user,
 * enriched with room details and a recording count per meeting.
 *
 * Only events of type "meeting" are returned — "event" and "reminder" types
 * are intentionally excluded because the Meetings view is meeting-specific.
 * The time range is computed from the server's local midnight to 23:59:59
 * (UTC), which matches how events are stored.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

async function resolveUserId(email: string) {
  const { data } = await getSupabase().from("users").select("id").eq("email", email).single();
  return data?.id as string | null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const workspaceId = req.nextUrl.searchParams.get("workspaceId");

  // Build the today window using the server's local date parts so the range
  // stays correct regardless of what the client's timezone is.
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

  let query = getSupabase()
    .from("calendar_events")
    .select("id, title, description, location, start_at, end_at, all_day, color, room_id")
    .eq("user_id", userId)
    .eq("type", "meeting")
    .gte("start_at", start)
    .lte("start_at", end)
    .order("start_at", { ascending: true });

  if (workspaceId) {
    query = query.eq("room_id", workspaceId);
  }

  const { data: events, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich each meeting with room info and recording count in parallel.
  // N+1 queries are acceptable here because today's meetings are typically < 20.
  const enriched = await Promise.all((events ?? []).map(async (ev) => {
    const [roomRes, recRes] = await Promise.all([
      ev.room_id
        ? getSupabase().from("rooms").select("name, emoji, color").eq("id", ev.room_id).single()
        : Promise.resolve({ data: null }),
      getSupabase()
        .from("meeting_recordings")
        .select("id", { count: "exact", head: true })
        .eq("event_id", ev.id),
    ]);
    return {
      ...ev,
      room:            roomRes.data ?? null,
      recording_count: recRes.count ?? 0,
    };
  }));

  return NextResponse.json({ meetings: enriched });
}

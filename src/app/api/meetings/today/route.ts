import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

async function resolveUserId(email: string) {
  const { data } = await getSupabase().from("users").select("id").eq("email", email).single();
  return data?.id as string | null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

  const { data: events, error } = await getSupabase()
    .from("calendar_events")
    .select("id, title, description, location, start_at, end_at, all_day, color, room_id")
    .eq("user_id", userId)
    .eq("type", "meeting")
    .gte("start_at", start)
    .lte("start_at", end)
    .order("start_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with room name and recording count
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

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

async function resolveUserId(email: string) {
  const { data } = await getSupabase().from("users").select("id").eq("email", email).single();
  return data?.id as string | null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const search = req.nextUrl.searchParams.get("q")        ?? "";
  const page   = parseInt(req.nextUrl.searchParams.get("page") ?? "0");
  const limit  = 20;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  let query = getSupabase()
    .from("calendar_events")
    .select("id, title, description, location, start_at, end_at, all_day, color, room_id", { count: "exact" })
    .eq("user_id", userId)
    .eq("type", "meeting")
    .lt("start_at", todayStart.toISOString())
    .order("start_at", { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  if (search) query = query.ilike("title", `%${search}%`);

  const { data: events, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach room names and recording counts
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
    return { ...ev, room: roomRes.data ?? null, recording_count: recRes.count ?? 0 };
  }));

  return NextResponse.json({ meetings: enriched, total: count ?? 0, page, limit });
}

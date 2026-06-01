import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const { data: user } = await getSupabase()
    .from("users")
    .select("id, name, avatar_url")
    .eq("calendar_share_token", token)
    .single();

  if (!user) return NextResponse.json({ error: "Calendario no encontrado" }, { status: 404 });

  const start = req.nextUrl.searchParams.get("start");
  const end   = req.nextUrl.searchParams.get("end");

  let query = getSupabase()
    .from("calendar_events")
    .select("id, title, description, location, type, start_at, end_at, all_day, color")
    .eq("user_id", user.id)
    .order("start_at", { ascending: true });

  if (start) query = query.gte("start_at", start);
  if (end)   query = query.lte("start_at", end);

  const { data: events, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    owner: { name: user.name, avatar_url: user.avatar_url },
    events: events ?? [],
  });
}

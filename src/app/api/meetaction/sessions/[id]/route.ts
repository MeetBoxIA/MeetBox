import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

async function resolveUserId(email: string): Promise<string | null> {
  const { data } = await getSupabase().from("users").select("id").eq("email", email).single();
  return data?.id ?? null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { id } = await params;
  const { data, error } = await getSupabase()
    .from("meet_action_sessions")
    .select(`
      id, meeting_name, meeting_date, duration_seconds, status,
      summary_ai, decisions_count, tasks_count, risks_count, next_steps_count,
      people_mentioned, risks_detected, calendar_match_pct, room_id,
      created_at, approved_at, executed_at,
      calendar_events ( id, title, start_at ),
      meeting_recordings ( id, title, file_name ),
      rooms ( id, name, color, emoji )
    `)
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session: data });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const allowed = ["room_id", "calendar_event_id", "calendar_match_pct", "meeting_name", "status"];
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (body[key] !== undefined) patch[key] = body[key] === "" ? null : body[key];
  }

  const { data, error } = await getSupabase()
    .from("meet_action_sessions")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session: data });
}

/**
 * GET  /api/meetaction/sessions — list all sessions for the authenticated user
 * POST /api/meetaction/sessions — create a new review session (called by the AI
 *      processing pipeline after a recording is transcribed)
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

async function resolveUserId(email: string): Promise<string | null> {
  const { data } = await getSupabase().from("users").select("id").eq("email", email).single();
  return data?.id ?? null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const url      = new URL(req.url);
  const status   = url.searchParams.get("status") ?? undefined;
  const limit    = Math.min(50, Number(url.searchParams.get("limit") ?? 20));

  let query = getSupabase()
    .from("meet_action_sessions")
    .select(`
      id, meeting_name, meeting_date, duration_seconds, status,
      summary_ai, decisions_count, tasks_count, risks_count, next_steps_count,
      people_mentioned, risks_detected, calendar_match_pct,
      created_at, approved_at, executed_at,
      calendar_events ( id, title, start_at ),
      meeting_recordings ( id, title, file_name )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessions: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  const { data, error } = await getSupabase()
    .from("meet_action_sessions")
    .insert({
      user_id:             userId,
      recording_id:        body.recording_id ?? null,
      calendar_event_id:   body.calendar_event_id ?? null,
      calendar_match_pct:  body.calendar_match_pct ?? null,
      meeting_name:        body.meeting_name ?? "Reunión sin título",
      meeting_date:        body.meeting_date ?? new Date().toISOString(),
      duration_seconds:    body.duration_seconds ?? null,
      status:              "pending_review",
      summary_ai:          body.summary_ai ?? null,
      decisions_count:     body.decisions_count ?? 0,
      tasks_count:         body.tasks_count ?? 0,
      risks_count:         body.risks_count ?? 0,
      next_steps_count:    body.next_steps_count ?? 0,
      people_mentioned:    body.people_mentioned ?? [],
      risks_detected:      body.risks_detected ?? [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session: data }, { status: 201 });
}

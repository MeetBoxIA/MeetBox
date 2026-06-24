/**
 * GET /api/meetaction/history
 * Returns paginated execution log with item-level detail for the authenticated user.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: u } = await getSupabase().from("users").select("id").eq("email", session.user.email).single();
  if (!u) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const url   = new URL(req.url);
  const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 50));

  const { data, error } = await getSupabase()
    .from("meet_action_execution_log")
    .select(`
      id, destination, status, title, external_id, external_url, error_message, executed_at,
      meet_action_sessions ( id, meeting_name, meeting_date ),
      meet_action_executions ( id, status, executed_items, failed_items )
    `)
    .eq("user_id", u.id)
    .order("executed_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ history: data ?? [] });
}

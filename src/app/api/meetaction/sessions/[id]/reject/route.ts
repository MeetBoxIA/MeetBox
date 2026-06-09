/**
 * POST /api/meetaction/sessions/[id]/reject
 * Rejects the entire session — marks the session and all its items rejected.
 * Nothing is dispatched to any integration.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

async function resolveUserId(email: string) {
  const { data } = await getSupabase().from("users").select("id").eq("email", email).single();
  return data?.id as string | null;
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { id } = await params;
  const db = getSupabase();

  const { data: meetSession } = await db
    .from("meet_action_sessions").select("id").eq("id", id).eq("user_id", userId).maybeSingle();
  if (!meetSession) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });

  const now = new Date().toISOString();
  await db.from("meet_action_items").update({ status: "rejected", updated_at: now }).eq("session_id", id);
  await db.from("meet_action_sessions").update({ status: "rejected", updated_at: now }).eq("id", id);

  return NextResponse.json({ status: "rejected" });
}

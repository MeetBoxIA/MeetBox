/**
 * POST /api/meetaction/sessions/[id]/approve
 * Approves the session for execution. Optionally accepts a body of per-item
 * decisions { approve: string[], reject: string[] }; otherwise approves every
 * still-pending item. Marks the session 'approved' but does NOT execute — the
 * caller then hits /execute.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";
import { pipelineLogger, newCorrelationId } from "@/lib/logger";

async function resolveUserId(email: string) {
  const { data } = await getSupabase().from("users").select("id").eq("email", email).single();
  return data?.id as string | null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { id } = await params;
  const db = getSupabase();

  // Verify ownership + grab correlation id for tracing.
  const { data: meetSession } = await db
    .from("meet_action_sessions").select("id, correlation_id")
    .eq("id", id).eq("user_id", userId).maybeSingle();
  if (!meetSession) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const approveIds: string[] | undefined = Array.isArray(body.approve) ? body.approve : undefined;
  const rejectIds:  string[] | undefined = Array.isArray(body.reject)  ? body.reject  : undefined;

  const now = new Date().toISOString();

  if (approveIds || rejectIds) {
    // Selective approval
    if (approveIds?.length) {
      await db.from("meet_action_items")
        .update({ status: "approved", approved_at: now, updated_at: now })
        .eq("session_id", id).in("id", approveIds);
    }
    if (rejectIds?.length) {
      await db.from("meet_action_items")
        .update({ status: "rejected", updated_at: now })
        .eq("session_id", id).in("id", rejectIds);
    }
  } else {
    // Approve everything still pending
    await db.from("meet_action_items")
      .update({ status: "approved", approved_at: now, updated_at: now })
      .eq("session_id", id).eq("status", "pending");
  }

  await db.from("meet_action_sessions")
    .update({ status: "approved", approved_at: now, updated_at: now })
    .eq("id", id);

  const { count } = await db
    .from("meet_action_items")
    .select("id", { count: "exact", head: true })
    .eq("session_id", id).eq("status", "approved");

  const log = pipelineLogger({
    correlationId: meetSession.correlation_id ?? newCorrelationId(),
    userId, sessionId: id,
  });
  await log.event("meeting.actions.created", "Sesión aprobada por el usuario", { approved: count ?? 0 });

  return NextResponse.json({ status: "approved", approved_items: count ?? 0 });
}

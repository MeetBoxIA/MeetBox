/**
 * POST /api/meetaction/sessions/[id]/execute
 *
 * Triggers execution of all approved action items in a session.
 * Creates an execution record, then dispatches each item to its destination.
 * In production this would be a background job; here it runs synchronously
 * for simplicity but the client polls the execution status.
 *
 * The actual dispatch to Jira/Slack/Notion/etc. is handled by destination-
 * specific adapters (currently stubbed — integration backends are pending).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

type Params = { params: Promise<{ id: string }> };

async function resolveUserId(email: string) {
  const { data } = await getSupabase().from("users").select("id").eq("email", email).single();
  return data?.id as string | null;
}

// Stub dispatcher — replace each case with real integration calls
async function dispatchItem(item: Record<string, unknown>): Promise<{ ok: boolean; external_id?: string; external_url?: string; error?: string }> {
  // Simulate network latency per destination
  await new Promise((r) => setTimeout(r, 300 + Math.random() * 700));

  switch (item.destination) {
    case "meetbook":
    case "meetcalendar":
      // Internal destinations: handled via existing API routes
      return { ok: true, external_id: `internal-${Date.now()}`, external_url: "/dashboard" };
    default:
      // External integrations: stub pending real OAuth + API calls
      return { ok: true, external_id: `stub-${Date.now()}`, external_url: "#" };
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { id } = await params;
  const db = getSupabase();

  // Verify ownership
  const { data: meetSession } = await db
    .from("meet_action_sessions").select("id, status")
    .eq("id", id).eq("user_id", userId).single();
  if (!meetSession) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });

  // Get all approved items
  const { data: items } = await db
    .from("meet_action_items")
    .select("*")
    .eq("session_id", id)
    .eq("status", "approved");

  if (!items?.length) return NextResponse.json({ error: "No hay ítems aprobados para ejecutar" }, { status: 400 });

  // Create execution record
  const destinations = [...new Set(items.map((i) => i.destination as string))];
  const assignees    = [...new Set(items.map((i) => i.assignee_name as string).filter(Boolean))];

  const { data: execution } = await db
    .from("meet_action_executions")
    .insert({
      session_id:       id,
      user_id:          userId,
      status:           "running",
      total_items:      items.length,
      approved_items:   items.length,
      destinations_used: destinations,
      assignees,
    })
    .select().single();

  if (!execution) return NextResponse.json({ error: "Error creando ejecución" }, { status: 500 });

  // Update session status
  await db.from("meet_action_sessions")
    .update({ status: "approved", approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);

  // Dispatch items (runs in background conceptually — in prod use a queue)
  let executedCount = 0;
  let failedCount   = 0;
  const errorLog: unknown[] = [];

  for (const item of items) {
    // Mark as executing
    await db.from("meet_action_items")
      .update({ status: "executing", updated_at: new Date().toISOString() })
      .eq("id", item.id);

    const result = await dispatchItem(item as Record<string, unknown>);

    if (result.ok) {
      executedCount++;
      await db.from("meet_action_items")
        .update({ status: "executed", external_id: result.external_id, external_url: result.external_url, executed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", item.id);
    } else {
      failedCount++;
      errorLog.push({ item_id: item.id, error: result.error, timestamp: new Date().toISOString() });
      await db.from("meet_action_items")
        .update({ status: "failed", error_message: result.error, updated_at: new Date().toISOString() })
        .eq("id", item.id);
    }

    // Log each item execution
    await db.from("meet_action_execution_log").insert({
      execution_id:  execution.id,
      item_id:       item.id,
      session_id:    id,
      user_id:       userId,
      destination:   item.destination,
      status:        result.ok ? "success" : "failed",
      title:         item.title,
      external_id:   result.external_id ?? null,
      external_url:  result.external_url ?? null,
      error_message: result.error ?? null,
    });
  }

  const finalStatus = failedCount === 0 ? "completed" : executedCount === 0 ? "failed" : "partial";

  // Update execution record
  await db.from("meet_action_executions")
    .update({ status: finalStatus, executed_items: executedCount, failed_items: failedCount, completed_at: new Date().toISOString(), error_log: errorLog })
    .eq("id", execution.id);

  // Update session final status
  await db.from("meet_action_sessions")
    .update({ status: failedCount === 0 ? "executed" : "partial", executed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ execution_id: execution.id, status: finalStatus, executed: executedCount, failed: failedCount });
}

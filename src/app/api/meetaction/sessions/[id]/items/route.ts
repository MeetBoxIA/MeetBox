/**
 * GET   /api/meetaction/sessions/[id]/items — list all action items for a session
 * POST  /api/meetaction/sessions/[id]/items — create a new item
 * PATCH /api/meetaction/sessions/[id]/items — bulk update item statuses (approve/reject)
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

type Params = { params: Promise<{ id: string }> };

async function resolveUserId(email: string) {
  const { data } = await getSupabase().from("users").select("id").eq("email", email).single();
  return data?.id as string | null;
}

async function verifyOwner(sessionId: string, userId: string) {
  const { data } = await getSupabase()
    .from("meet_action_sessions").select("id")
    .eq("id", sessionId).eq("user_id", userId).single();
  return !!data;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  const { id } = await params;
  if (!(await verifyOwner(id, userId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { data, error } = await getSupabase()
    .from("meet_action_items")
    .select("*")
    .eq("session_id", id)
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  const { id } = await params;
  if (!(await verifyOwner(id, userId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { data, error } = await getSupabase()
    .from("meet_action_items")
    .insert({
      session_id:       id,
      user_id:          userId,
      type:             body.type ?? "task",
      destination:      body.destination ?? "meetbook",
      status:           "pending",
      title:            body.title ?? "Acción sin título",
      description:      body.description ?? null,
      assignee_name:    body.assignee_name ?? null,
      assignee_email:   body.assignee_email ?? null,
      priority:         body.priority ?? "medium",
      sort_order:       body.sort_order ?? 0,
      destination_meta: body.destination_meta ?? {},
    })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data }, { status: 201 });
}

// Bulk approve/reject items
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  const { id } = await params;
  if (!(await verifyOwner(id, userId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  // body: { updates: [{ id, status, title, description, assignee_name, priority, destination }] }
  const updates: { id: string; status?: string; title?: string; description?: string; assignee_name?: string; priority?: string; destination?: string }[] = body.updates ?? [];

  const results = await Promise.all(
    updates.map(({ id: itemId, ...patch }) =>
      getSupabase()
        .from("meet_action_items")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", itemId)
        .eq("session_id", id)
        .select("id, status")
        .single()
    )
  );

  return NextResponse.json({ updated: results.map((r) => r.data).filter(Boolean) });
}

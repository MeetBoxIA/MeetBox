/**
 * PATCH  /api/meetaction/items/[id] — edit a single action item before approval
 * DELETE /api/meetaction/items/[id] — remove an action item
 *
 * The user can fully edit any AI-generated action (title, description, assignee,
 * priority, type, destination) before approving it. Ownership is enforced by
 * joining through the parent session's user_id.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

async function resolveUserId(email: string) {
  const { data } = await getSupabase().from("users").select("id").eq("email", email).single();
  return data?.id as string | null;
}

const EDITABLE = ["title", "description", "assignee_name", "assignee_email", "priority", "type", "destination", "status", "destination_meta"] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  // Whitelist editable fields only.
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of EDITABLE) {
    if (body[key] !== undefined) patch[key] = body[key];
  }

  const { data, error } = await getSupabase()
    .from("meet_action_items")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)   // ownership guard
    .select("*").maybeSingle();

  if (error)  return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: "Acción no encontrada" }, { status: 404 });
  return NextResponse.json({ item: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { id } = await params;
  const { error } = await getSupabase()
    .from("meet_action_items").delete().eq("id", id).eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: id });
}

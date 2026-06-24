import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

async function resolveUserId(email: string) {
  const { data } = await getSupabase().from("users").select("id").eq("email", email).single();
  return data?.id as string | null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; mid: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { mid } = await params;
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, string> = {};
  if (body.name?.trim())  patch.name  = String(body.name).trim();
  if (body.email?.trim()) patch.email = String(body.email).trim().toLowerCase();

  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });

  const { data, error } = await getSupabase()
    .from("room_members").update(patch).eq("id", mid).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ member: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ mid: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { mid } = await params;
  const { error } = await getSupabase().from("room_members").delete().eq("id", mid);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

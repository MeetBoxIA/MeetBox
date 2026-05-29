import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

async function resolveUserId(email: string) {
  const { data } = await getSupabase().from("users").select("id").eq("email", email).single();
  return data?.id as string | null;
}

async function verifyRoomOwner(roomId: string, userId: string) {
  const { data } = await getSupabase()
    .from("rooms").select("id").eq("id", roomId).eq("user_id", userId).single();
  return !!data;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const { data, error } = await getSupabase()
    .from("room_members")
    .select("id, name, email, created_at")
    .eq("room_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ members: data ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { id } = await params;
  if (!(await verifyRoomOwner(id, userId)))
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { name, email } = await req.json().catch(() => ({}));
  if (!name?.trim() || !email?.trim())
    return NextResponse.json({ error: "name y email son requeridos" }, { status: 400 });

  const { data, error } = await getSupabase()
    .from("room_members")
    .insert({ room_id: id, name: String(name).trim(), email: String(email).trim().toLowerCase() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ member: data }, { status: 201 });
}

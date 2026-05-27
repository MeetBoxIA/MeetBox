import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

async function resolveUserId(email: string) {
  const { data } = await getSupabase().from("users").select("id").eq("email", email).single();
  return data?.id as string | null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { data, error } = await getSupabase()
    .from("notebooks")
    .select("id, title, emoji, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notebooks: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { title = "Sin título", emoji = "📓" } = await req.json().catch(() => ({}));

  const { data, error } = await getSupabase()
    .from("notebooks")
    .insert({ user_id: userId, title: String(title).trim() || "Sin título", emoji })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notebook: data }, { status: 201 });
}

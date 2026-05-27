import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

async function resolveUserId(email: string) {
  const { data } = await getSupabase().from("users").select("id").eq("email", email).single();
  return data?.id as string | null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const notebookId = req.nextUrl.searchParams.get("notebookId");
  if (!notebookId) return NextResponse.json({ error: "notebookId requerido" }, { status: 400 });

  const { data, error } = await getSupabase()
    .from("notes")
    .select("id, notebook_id, title, content, emoji, is_pinned, created_at, updated_at")
    .eq("notebook_id", notebookId)
    .eq("user_id", userId)
    .order("is_pinned", { ascending: false })
    .order("updated_at",  { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notes: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { notebookId, title = "Sin título", emoji = "📄" } = await req.json().catch(() => ({}));
  if (!notebookId) return NextResponse.json({ error: "notebookId requerido" }, { status: 400 });

  const { data, error } = await getSupabase()
    .from("notes")
    .insert({
      user_id:     userId,
      notebook_id: notebookId,
      title:       String(title).trim() || "Sin título",
      emoji,
      content:     "",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ note: data }, { status: 201 });
}

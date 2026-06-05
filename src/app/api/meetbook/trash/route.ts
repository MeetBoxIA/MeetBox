import { NextResponse } from "next/server";
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

  const [nbRes, notesRes] = await Promise.all([
    getSupabase()
      .from("notebooks")
      .select("id, title, emoji, deleted_at")
      .eq("user_id", userId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),

    getSupabase()
      .from("notes")
      .select("id, title, emoji, deleted_at, notebook_id, notebooks(title)")
      .eq("user_id", userId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
  ]);

  if (nbRes.error || notesRes.error) {
    return NextResponse.json({ error: "Error al cargar papelera" }, { status: 500 });
  }

  const notes = (notesRes.data ?? []).map((n: Record<string, unknown>) => {
    const nb = n.notebooks as { title?: string } | null;
    return { ...n, notebook_title: nb?.title ?? null, notebooks: undefined };
  });

  return NextResponse.json({ notebooks: nbRes.data ?? [], notes });
}

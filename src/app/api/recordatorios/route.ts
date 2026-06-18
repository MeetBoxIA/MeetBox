import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data, error } = await getSupabase()
    .from("reminders")
    .select("*")
    .eq("user_email", session.user.email)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reminders: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (!body.title?.trim()) return NextResponse.json({ error: "Título requerido" }, { status: 400 });

  const { data, error } = await getSupabase()
    .from("reminders")
    .insert({
      user_email: session.user.email,
      title:      String(body.title).trim(),
      source:     body.source ?? "manual",
      session_id: body.session_id ?? null,
      deadline:   body.deadline   ?? null,
      completed:  false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reminder: data }, { status: 201 });
}

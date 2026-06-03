import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";
import { randomBytes } from "crypto";

function newToken(): string {
  return "MBOX-" + randomBytes(4).toString("hex").toUpperCase();
}

async function resolveUserId(email: string): Promise<string | null> {
  const { data } = await getSupabase().from("users").select("id").eq("email", email).single();
  return data?.id ?? null;
}

// GET — devuelve el token activo del usuario o genera uno nuevo
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const db = getSupabase();
  const { data: existing } = await db
    .from("desktop_tokens")
    .select("token")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.token) return NextResponse.json({ token: existing.token });

  // Generar token nuevo
  const token = newToken();
  await db.from("desktop_tokens").insert({ user_id: userId, token });
  return NextResponse.json({ token });
}

// DELETE — regenera el token (revoca el anterior)
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const db = getSupabase();
  await db.from("desktop_tokens").delete().eq("user_id", userId);

  const token = newToken();
  await db.from("desktop_tokens").insert({ user_id: userId, token });
  return NextResponse.json({ token });
}

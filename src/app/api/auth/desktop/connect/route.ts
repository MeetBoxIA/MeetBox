import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// POST — valida un código MBOX-XXXXXXXX y devuelve la info del usuario
// Llamado por MeetBox Desktop desde la pantalla de conexión inicial.
// No requiere sesión web — el código ES la autenticación.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = String(body.token ?? "").trim().toUpperCase();

  if (!/^MBOX-[0-9A-F]{8}$/.test(token)) {
    return NextResponse.json({ error: "Código inválido." }, { status: 400 });
  }

  const db = getSupabase();

  const { data: row } = await db
    .from("desktop_tokens")
    .select("user_id, last_used_at")
    .eq("token", token)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: "Código no encontrado o expirado." }, { status: 404 });
  }

  // Actualizar last_used_at
  await db
    .from("desktop_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token", token);

  const { data: user } = await db
    .from("users")
    .select("id, name, email, avatar_url")
    .eq("id", row.user_id)
    .single();

  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id:     user.id,
      name:   user.name,
      email:  user.email,
      avatar: user.avatar_url ?? null,
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Faltan campos requeridos." }, { status: 400 });
  }

  const db = getSupabase();

  // Verificar si el email ya existe
  const { data: existing } = await db
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Este email ya está registrado." }, { status: 409 });
  }

  const password_hash = await bcrypt.hash(password, 12);

  const { error } = await db
    .from("users")
    .insert({ name, email, password_hash, provider: "email" });

  if (error) {
    console.error("Error creando usuario:", error.message);
    return NextResponse.json({ error: "Error al crear la cuenta." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

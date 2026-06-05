/**
 * POST /api/auth/register
 *
 * Creates a new email/password account.
 * Called after OTP verification succeeds — the OTP step happens upstream
 * (send/verify), so by the time this route is hit we trust the email is real.
 *
 * Uses bcrypt cost factor 12 — high enough to resist brute force while
 * still completing in ~250ms on modern hardware.
 */
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabase } from "@/lib/supabase";
import { RegisterSchema } from "@/lib/validators";

export async function POST(req: NextRequest) {
  const body   = await req.json().catch(() => ({}));
  const result = RegisterSchema.safeParse(body);

  if (!result.success) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errors = result.error.issues.map((e: any) => ({ field: String(e.path?.join(".")), message: String(e.message) }));
    return NextResponse.json({ error: "Datos inválidos.", errors }, { status: 400 });
  }

  const { name, email, password } = result.data;
  const db = getSupabase();

  // Prevent duplicate accounts — Supabase unique constraint on email would
  // also catch this, but a friendly check here gives a better error message.
  const { data: existing } = await db
    .from("users")
    .select("id")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Este email ya está registrado." }, { status: 409 });
  }

  const password_hash = await bcrypt.hash(password, 12);

  const { error } = await db.from("users").insert({
    name: name.trim(), email: email.toLowerCase(), password_hash, provider: "email",
  });

  if (error) {
    console.error("Error creating user:", error.message);
    return NextResponse.json({ error: "Error al crear la cuenta." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

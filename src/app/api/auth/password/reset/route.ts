/**
 * POST /api/auth/password/reset
 *
 * Validates the token from the reset email and sets a new password.
 */
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { checkResetToken, consumeResetToken } from "@/lib/reset-token-store";

const ResetSchema = z.object({
  email:    z.string().email(),
  token:    z.string().length(64),
  password: z.string()
    .min(8,  "La contraseña debe tener al menos 8 caracteres")
    .max(128)
    .regex(/[A-Z]/, "Debe contener al menos una letra mayúscula")
    .regex(/[0-9]/, "Debe contener al menos un número"),
});

export async function POST(req: NextRequest) {
  const body   = await req.json().catch(() => ({}));
  const result = ResetSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: "Datos inválidos.", errors: result.error.issues }, { status: 400 });
  }

  const { email, token, password } = result.data;
  const normalizedEmail = email.toLowerCase().trim();

  const check = checkResetToken(normalizedEmail, token);

  if (!check.valid) {
    const messages: Record<string, string> = {
      missing: "El enlace no es válido.",
      expired: "El enlace expiró. Solicita uno nuevo.",
      used:    "Este enlace ya fue utilizado.",
      invalid: "El enlace no es válido.",
    };
    return NextResponse.json({ error: messages[check.reason] ?? "Token inválido." }, { status: 400 });
  }

  const db = getSupabase();

  // Gate by password_hash, not provider: an account that also linked Google
  // can still reset its password as long as it has one set.
  const { data: user } = await db
    .from("users")
    .select("id, password_hash")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (!user?.password_hash) {
    return NextResponse.json({ error: "Cuenta no encontrada." }, { status: 404 });
  }

  const password_hash = await bcrypt.hash(password, 12);

  const { error } = await db
    .from("users")
    .update({ password_hash })
    .eq("id", user.id);

  if (error) {
    console.error("[reset-password] DB error:", error.message);
    return NextResponse.json({ error: "Error al actualizar la contraseña." }, { status: 500 });
  }

  // Invalidate the token so it cannot be reused.
  consumeResetToken(normalizedEmail);

  return NextResponse.json({ success: true });
}

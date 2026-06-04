import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";
import { createHash, createCipheriv } from "crypto";

// ── Stateless token: AES-128-ECB(userId_bytes, key)
// No requiere tabla en DB. El token encripta el userId del usuario;
// el endpoint /connect lo decripta y hace lookup por ID.
// Formato: MBOX-{32 hex chars} = MBOX- + AES(16 bytes UUID) as hex
// ──────────────────────────────────────────────────────────────────

function aesKey(): Buffer {
  return createHash("sha256").update(process.env.AUTH_SECRET ?? "fallback").digest().subarray(0, 16);
}

function encryptUserId(userId: string): string {
  const key       = aesKey();
  const plaintext = Buffer.from(userId.replace(/-/g, ""), "hex"); // UUID → 16 bytes
  const cipher    = createCipheriv("aes-128-ecb", key, null);
  cipher.setAutoPadding(false);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return "MBOX-" + encrypted.toString("hex").toUpperCase();
}

async function resolveUserId(email: string): Promise<string | null> {
  const { data } = await getSupabase().from("users").select("id").eq("email", email).single();
  return data?.id ?? null;
}

// GET — devuelve el token del usuario autenticado (siempre el mismo, derivado del userId)
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  return NextResponse.json({ token: encryptUserId(userId) });
}

// DELETE — el token es determinístico (cambiarlo requeriría cambiar el AUTH_SECRET).
// Devolvemos el mismo token con un mensaje informativo.
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  return NextResponse.json({ token: encryptUserId(userId) });
}

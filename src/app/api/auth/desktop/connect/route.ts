import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { createHash, createDecipheriv } from "crypto";

// Electron renderiza desde file:// o localhost:5173 (dev). Chromium aplica
// CORS → necesitamos estos headers en TODAS las respuestas de este endpoint.
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function aesKey(): Buffer {
  return createHash("sha256").update(process.env.AUTH_SECRET ?? "fallback").digest().subarray(0, 16);
}

function decryptToken(token: string): string | null {
  try {
    const hex = token.slice(5); // quitar "MBOX-"
    if (hex.length !== 32) return null;
    const decipher = createDecipheriv("aes-128-ecb", aesKey(), null);
    decipher.setAutoPadding(false);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(hex, "hex")), decipher.final()]);
    const h = decrypted.toString("hex");
    // Reconstruir UUID con guiones
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  } catch {
    return null;
  }
}

// Preflight OPTIONS
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// POST — valida el código MBOX-{32hex}, decripta el userId y devuelve info del usuario.
// No requiere sesión web ni tabla adicional en DB.
export async function POST(req: NextRequest) {
  const body  = await req.json().catch(() => ({}));
  const token = String(body.token ?? "").trim().toUpperCase();

  if (!/^MBOX-[0-9A-F]{32}$/.test(token)) {
    return NextResponse.json(
      { error: "Código inválido. Asegúrate de copiarlo completo desde Integraciones." },
      { status: 400, headers: CORS },
    );
  }

  const userId = decryptToken(token);
  if (!userId) {
    return NextResponse.json(
      { error: "Código no válido o generado con una clave diferente." },
      { status: 400, headers: CORS },
    );
  }

  const { data: user, error } = await getSupabase()
    .from("users")
    .select("id, name, email, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  if (error || !user) {
    return NextResponse.json(
      { error: "Usuario no encontrado. Genera el código de nuevo desde Integraciones." },
      { status: 404, headers: CORS },
    );
  }

  return NextResponse.json(
    { user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar_url ?? null } },
    { headers: CORS },
  );
}

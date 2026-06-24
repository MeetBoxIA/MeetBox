import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

/**
 * GET /api/auth/zoom/status
 * Devuelve si el usuario tiene Zoom conectado y su email de Zoom.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ connected: false }, { status: 401 });
  }

  const { data } = await getSupabase()
    .from("users")
    .select("zoom_access_token, zoom_email, zoom_user_id")
    .eq("email", session.user.email)
    .single();

  if (!data?.zoom_access_token) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    zoom_email:   data.zoom_email   ?? null,
    zoom_user_id: data.zoom_user_id ?? null,
  });
}

/**
 * DELETE /api/auth/zoom/status
 * Desconecta Zoom revocando el token y limpiando la BD.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Obtener el token actual para revocarlo en Zoom
  const { data } = await getSupabase()
    .from("users")
    .select("zoom_access_token")
    .eq("email", session.user.email)
    .single();

  if (data?.zoom_access_token) {
    const credentials = Buffer.from(
      `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`,
    ).toString("base64");

    // Revocar el token en Zoom (best-effort, no bloqueamos si falla)
    await fetch(`https://zoom.us/oauth/revoke?token=${data.zoom_access_token}`, {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}` },
    }).catch(() => {});
  }

  const { error } = await getSupabase()
    .from("users")
    .update({
      zoom_access_token:  null,
      zoom_refresh_token: null,
      zoom_token_expiry:  null,
      zoom_user_id:       null,
      zoom_email:         null,
    })
    .eq("email", session.user.email);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ disconnected: true });
}

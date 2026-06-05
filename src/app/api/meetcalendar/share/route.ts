import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";
import { randomBytes } from "crypto";

async function resolveUser(email: string) {
  const { data } = await getSupabase()
    .from("users")
    .select("id, name, calendar_share_token")
    .eq("email", email)
    .single();
  return data as { id: string; name: string; calendar_share_token: string | null } | null;
}

// GET — returns current token (or generates one)
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const user = await resolveUser(session.user.email);
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  if (user.calendar_share_token) {
    return NextResponse.json({ token: user.calendar_share_token, name: user.name });
  }

  // Generate new token
  const token = randomBytes(18).toString("base64url");
  await getSupabase().from("users").update({ calendar_share_token: token }).eq("id", user.id);
  return NextResponse.json({ token, name: user.name });
}

// DELETE — regenerates token (invalidates old link)
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: user } = await getSupabase()
    .from("users").select("id").eq("email", session.user.email).single();
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const token = randomBytes(18).toString("base64url");
  await getSupabase().from("users").update({ calendar_share_token: token }).eq("id", user.id);
  return NextResponse.json({ token });
}

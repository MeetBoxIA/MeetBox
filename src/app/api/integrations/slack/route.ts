/**
 * GET    /api/integrations/slack — connection status (team name, channel)
 * DELETE /api/integrations/slack — disconnect (revoke token + remove row)
 */
import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";
import { getSlackConnection, disconnectSlack } from "@/lib/integrations/slack";

async function resolveUserId(email: string): Promise<string | null> {
  const { data } = await getSupabase().from("users").select("id").eq("email", email).single();
  return data?.id ?? null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const conn = await getSlackConnection(userId);
  return NextResponse.json({
    connected: !!conn,
    team:      conn?.teamName ?? null,
    channel:   conn?.defaultChannel ?? null,
  });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  await disconnectSlack(userId);

  // Remove 'slack' from the profile list so the Integrations card updates.
  const db = getSupabase();
  const { data: profile } = await db
    .from("user_profiles").select("integrations").eq("user_id", userId).maybeSingle();
  const current: string[] = (profile?.integrations as string[] | null) ?? [];
  if (current.includes("slack")) {
    await db.from("user_profiles")
      .update({ integrations: current.filter((i) => i !== "slack") })
      .eq("user_id", userId);
  }

  return NextResponse.json({ disconnected: true });
}

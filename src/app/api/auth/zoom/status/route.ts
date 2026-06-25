import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";
import { getZoomConnection, disconnectZoom } from "@/lib/integrations/zoom";

async function resolveUserId(email: string): Promise<string | null> {
  const { data } = await getSupabase().from("users").select("id").eq("email", email).single();
  return data?.id ?? null;
}

/**
 * GET /api/auth/zoom/status
 * Returns whether the current user has Zoom connected via OAuth.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ connected: false }, { status: 401 });
  }

  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ connected: false });

  const conn = await getZoomConnection(userId);
  return NextResponse.json({ connected: !!conn });
}

/**
 * DELETE /api/auth/zoom/status
 * Revokes the Zoom token and removes the connection.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ disconnected: true });

  await disconnectZoom(userId);
  return NextResponse.json({ disconnected: true });
}

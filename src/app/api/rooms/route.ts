/**
 * /api/rooms
 *
 * GET  — list all rooms owned by the authenticated user
 * POST — create a new room
 *
 * Rooms are team spaces that group members and associate calendar events.
 * Each room is owned by one user (user_id) and can have many members and events.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

async function resolveUserId(email: string) {
  const { data } = await getSupabase().from("users").select("id").eq("email", email).single();
  return data?.id as string | null;
}

/** GET — return all rooms for the user, ordered by creation date. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data, error } = await getSupabase()
    .from("rooms")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rooms: data ?? [] });
}

/** POST — create a new room with the provided name, description, color, and emoji. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { name, description = null, color = "#050040", emoji = "🏢" } = await req.json().catch(() => ({}));
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const { data, error } = await getSupabase()
    .from("rooms")
    .insert({ user_id: userId, name: String(name).trim(), description, color, emoji })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ room: data }, { status: 201 });
}

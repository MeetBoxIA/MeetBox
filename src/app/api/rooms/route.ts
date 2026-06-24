/**
 * /api/rooms
 *
 * GET  — return owned rooms + rooms where user is a member (joined workspaces)
 * POST — create a new room
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";
import { checkLimit, limitErrorMessage } from "@/lib/plans";

async function resolveUser(email: string) {
  const { data } = await getSupabase()
    .from("users")
    .select("id, email, name")
    .eq("email", email)
    .single();
  return data as { id: string; email: string; name?: string } | null;
}

/** GET — return owned rooms + joined rooms (member of) with member counts. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const user = await resolveUser(session.user.email);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const db = getSupabase();

  // 1. Owned rooms
  const { data: ownedRooms, error: ownErr } = await db
    .from("rooms")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (ownErr) return NextResponse.json({ error: ownErr.message }, { status: 500 });

  // 2. Rooms where user's email appears in room_members (and they don't own it)
  const { data: memberships } = await db
    .from("room_members")
    .select("room_id")
    .eq("email", user.email);

  const memberRoomIds = (memberships ?? []).map((m) => m.room_id as string);
  const ownedIds = new Set((ownedRooms ?? []).map((r) => r.id as string));
  const joinedIds = memberRoomIds.filter((id) => !ownedIds.has(id));

  let joinedRooms: Array<Record<string, unknown>> = [];
  if (joinedIds.length > 0) {
    const { data: jRooms } = await db
      .from("rooms")
      .select("*")
      .in("id", joinedIds)
      .order("created_at", { ascending: true });

    // Fetch owner info for each joined room
    const ownerIds = [...new Set((jRooms ?? []).map((r) => r.user_id as string))];
    const { data: owners } = ownerIds.length > 0
      ? await db.from("users").select("id, email, name").in("id", ownerIds)
      : { data: [] };
    const ownerMap = new Map((owners ?? []).map((o) => [o.id as string, o]));

    joinedRooms = (jRooms ?? []).map((r) => {
      const owner = ownerMap.get(r.user_id as string);
      return { ...r, ownerEmail: owner?.email, ownerName: (owner as {name?: string})?.name ?? owner?.email };
    });
  }

  // 3. Member counts for all rooms
  const allRoomIds = [
    ...(ownedRooms ?? []).map((r) => r.id as string),
    ...joinedIds,
  ];
  const { data: memberRows } = allRoomIds.length > 0
    ? await db.from("room_members").select("room_id").in("room_id", allRoomIds)
    : { data: [] };
  const memberCounts: Record<string, number> = {};
  for (const row of memberRows ?? []) {
    const rid = row.room_id as string;
    memberCounts[rid] = (memberCounts[rid] ?? 0) + 1;
  }

  return NextResponse.json({
    rooms:       (ownedRooms ?? []).map((r) => ({ ...r, myRole: "owner",  memberCount: memberCounts[r.id as string] ?? 0 })),
    joined:      joinedRooms.map((r)         => ({ ...r, myRole: "member", memberCount: memberCounts[r.id as string] ?? 0 })),
    userName:    user.name ?? session.user.name ?? session.user.email,
  });
}

/** POST — create a new room. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const user = await resolveUser(session.user.email);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { name, description = null, color = "#050040", emoji = "🏢" } = await req.json().catch(() => ({}));
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  // ── Verificar límite de workspaces del plan ──────────────────────────────
  const { count: roomCount } = await getSupabase()
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  const limitCheck = await checkLimit(user.id, "rooms", roomCount ?? 0);
  if (!limitCheck.allowed) {
    return NextResponse.json(
      { error: limitErrorMessage("rooms", limitCheck.limit, limitCheck.plan), limitReached: true, limit: limitCheck.limit, current: limitCheck.current, plan: limitCheck.plan },
      { status: 403 },
    );
  }

  const { data, error } = await getSupabase()
    .from("rooms")
    .insert({ user_id: user.id, name: String(name).trim(), description, color, emoji })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ room: data }, { status: 201 });
}

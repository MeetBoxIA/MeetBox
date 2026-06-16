import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

async function resolveUserId(email: string): Promise<string | null> {
  const { data } = await getSupabase().from("users").select("id").eq("email", email).single();
  return data?.id ?? null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { id } = await params;

  const { data: mas } = await getSupabase()
    .from("meet_action_sessions")
    .select("room_id, people_mentioned")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!mas) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  if (!mas.room_id) {
    return NextResponse.json({ matched: [], unmatched: [], room_members: [], match_pct: 0 });
  }

  const { data: members } = await getSupabase()
    .from("room_members")
    .select("id, name, email")
    .eq("room_id", mas.room_id);

  const people: string[] = mas.people_mentioned ?? [];
  const mems = members ?? [];

  const matched: { person: string; member_name: string; member_email: string }[] = [];
  const unmatched: string[] = [];

  for (const person of people) {
    const norm = person.toLowerCase().trim();
    const found = mems.find(
      (m) => m.name.toLowerCase().includes(norm) || norm.includes(m.name.toLowerCase().split(" ")[0]),
    );
    if (found) {
      matched.push({ person, member_name: found.name, member_email: found.email });
    } else {
      unmatched.push(person);
    }
  }

  return NextResponse.json({
    matched,
    unmatched,
    room_members: mems,
    match_pct: people.length > 0 ? Math.round((matched.length / people.length) * 100) : 0,
  });
}

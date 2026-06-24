/**
 * /api/meety/conversations
 *
 * GET  — list all conversations for the authenticated user, newest first
 * POST — create a new blank conversation (verifica límite del plan)
 */
import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";
import { checkLimit, limitErrorMessage } from "@/lib/plans";

async function resolveUserId(email: string) {
  const { data } = await getSupabase().from("users").select("id").eq("email", email).single();
  return data?.id as string | null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data, error } = await getSupabase()
    .from("chat_conversations")
    .select("id, title, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversations: data ?? [] });
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // ── Verificar límite de conversaciones del plan ───────────────────────────
  const { count: convCount } = await getSupabase()
    .from("chat_conversations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const limitCheck = await checkLimit(userId, "conversationsMetty", convCount ?? 0);
  if (!limitCheck.allowed) {
    return NextResponse.json(
      {
        error: limitErrorMessage("conversationsMetty", limitCheck.limit, limitCheck.plan),
        limitReached: true,
        limit: limitCheck.limit,
        current: limitCheck.current,
        plan: limitCheck.plan,
      },
      { status: 403 },
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  const { data, error } = await getSupabase()
    .from("chat_conversations")
    .insert({ user_id: userId, title: "Nueva conversación" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversation: data }, { status: 201 });
}

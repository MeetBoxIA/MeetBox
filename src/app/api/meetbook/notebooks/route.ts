/**
 * /api/meetbook/notebooks
 *
 * GET  — list all non-deleted notebooks for the authenticated user
 * POST — create a new notebook (verifica límite del plan)
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";
import { checkLimit, limitErrorMessage } from "@/lib/plans";

async function resolveUserId(email: string) {
  const { data } = await getSupabase().from("users").select("id").eq("email", email).single();
  return data?.id as string | null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const userId      = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const workspaceId = req.nextUrl.searchParams.get("workspaceId");

  let query = getSupabase()
    .from("notebooks")
    .select("id, title, emoji, created_at, updated_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (workspaceId) {
    query = query.eq("room_id", workspaceId);
  } else {
    query = query.is("room_id", null);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notebooks: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // ── Verificar límite de notebooks del plan ────────────────────────────────
  const { count: notebookCount } = await getSupabase()
    .from("notebooks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null);

  const limitCheck = await checkLimit(userId, "notebooks", notebookCount ?? 0);
  if (!limitCheck.allowed) {
    return NextResponse.json(
      {
        error: limitErrorMessage("notebooks", limitCheck.limit, limitCheck.plan),
        limitReached: true,
        limit: limitCheck.limit,
        current: limitCheck.current,
        plan: limitCheck.plan,
      },
      { status: 403 },
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  const { title = "Sin título", emoji = "📓", workspaceId } = await req.json().catch(() => ({}));

  const { data, error } = await getSupabase()
    .from("notebooks")
    .insert({
      user_id: userId,
      title:   String(title).trim() || "Sin título",
      emoji,
      room_id: workspaceId ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notebook: data }, { status: 201 });
}

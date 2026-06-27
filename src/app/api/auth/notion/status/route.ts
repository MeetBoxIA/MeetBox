/**
 * GET  /api/auth/notion/status  — returns connection state
 * DELETE /api/auth/notion/status — disconnects Notion
 */
import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ connected: false }, { status: 401 });
  }

  const { data } = await getSupabase()
    .from("users")
    .select("notion_access_token, notion_workspace_name")
    .eq("email", session.user.email)
    .single();

  if (!data?.notion_access_token) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected:      true,
    workspace_name: data.notion_workspace_name ?? null,
  });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { error } = await getSupabase()
    .from("users")
    .update({
      notion_access_token:   null,
      notion_workspace_id:   null,
      notion_workspace_name: null,
      notion_bot_id:         null,
    })
    .eq("email", session.user.email);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ disconnected: true });
}

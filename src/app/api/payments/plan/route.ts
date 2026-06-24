/**
 * /api/payments/plan
 *
 * GET — retorna el plan activo del usuario autenticado y sus límites.
 *
 * El frontend usa esto para:
 *  - Mostrar el badge del plan en el sidebar
 *  - Saber los límites actuales y mostrar la barra de progreso
 *  - Decidir si mostrar el botón "Mejorar plan"
 */
import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";
import { getUserPlan, PLAN_LIMITS, PLAN_NAMES } from "@/lib/plans";

async function resolveUserId(email: string) {
  const { data } = await getSupabase().from("users").select("id").eq("email", email).single();
  return data?.id as string | null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const plan   = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];

  // Contar recursos actuales del usuario para mostrar uso en la UI
  const supabase = getSupabase();
  const [rooms, conversations, notebooks] = await Promise.all([
    supabase.from("rooms").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("chat_conversations").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("notebooks").select("id", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null),
  ]);

  return NextResponse.json({
    plan,
    planName:  PLAN_NAMES[plan],
    limits,
    usage: {
      rooms:              rooms.count         ?? 0,
      conversationsMetty: conversations.count ?? 0,
      notebooks:          notebooks.count      ?? 0,
    },
  });
}

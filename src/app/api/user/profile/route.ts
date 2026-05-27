import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Resolvemos el UUID real desde la tabla users usando el email.
  // session.user.id puede ser el sub de OAuth (Google) en lugar del UUID de Supabase
  // cuando el token fue emitido antes del fix del jwt callback.
  const { data: dbUser } = await getSupabase()
    .from("users")
    .select("id")
    .eq("email", session.user.email!)
    .single();

  if (!dbUser) {
    return NextResponse.json({ error: "Usuario no encontrado en la base de datos" }, { status: 404 });
  }

  const body = await req.json();
  const { orgName, teamSize, meetingTypes, tools, customTools } = body;

  if (!orgName || typeof orgName !== "string") {
    return NextResponse.json({ error: "orgName requerido" }, { status: 400 });
  }

  const integrations: string[] = [
    ...(Array.isArray(tools)       ? tools       : []),
    ...(Array.isArray(customTools) ? customTools : []),
  ];

  const { error } = await getSupabase()
    .from("user_profiles")
    .upsert(
      {
        user_id:       dbUser.id,
        org_name:      orgName.trim(),
        team_size:     teamSize ?? null,
        meeting_types: Array.isArray(meetingTypes) ? meetingTypes : [],
        integrations,
        onboarded_at:  new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (error) {
    console.error("❌ Error guardando perfil:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: dbUser } = await getSupabase()
    .from("users")
    .select("id")
    .eq("email", session.user.email)
    .single();

  if (!dbUser) {
    return NextResponse.json({ profile: null });
  }

  const { data, error } = await getSupabase()
    .from("user_profiles")
    .select("*")
    .eq("user_id", dbUser.id)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data ?? null });
}

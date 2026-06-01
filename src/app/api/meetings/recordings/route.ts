import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

async function resolveUserId(email: string) {
  const { data } = await getSupabase().from("users").select("id").eq("email", email).single();
  return data?.id as string | null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { data, error } = await getSupabase()
    .from("meeting_recordings")
    .select("id, title, file_name, file_size, mime_type, storage_path, status, created_at, event_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const recordings = (data ?? []).map((r) => ({
    ...r,
    public_url: r.storage_path
      ? getSupabase().storage.from("recordings").getPublicUrl(r.storage_path).data.publicUrl
      : null,
  }));

  return NextResponse.json({ recordings });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: "Formato inválido" }, { status: 400 }); }

  const file    = formData.get("file")     as File   | null;
  const eventId = formData.get("event_id") as string | null;
  const title   = (formData.get("title")   as string | null)?.trim();

  if (!file) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });

  const bytes       = await file.arrayBuffer();
  const buffer      = Buffer.from(bytes);
  const storagePath = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const { error: storageError } = await getSupabase()
    .storage
    .from("recordings")
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (storageError) {
    return NextResponse.json(
      { error: `Error de almacenamiento: ${storageError.message}. Asegúrate de crear el bucket "recordings" en Supabase Storage.` },
      { status: 500 },
    );
  }

  const { data, error: dbError } = await getSupabase()
    .from("meeting_recordings")
    .insert({
      user_id:      userId,
      event_id:     eventId || null,
      title:        title || file.name,
      file_name:    file.name,
      file_size:    file.size,
      mime_type:    file.type,
      storage_path: storagePath,
      status:       "ready",
    })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  const publicUrl = getSupabase().storage.from("recordings").getPublicUrl(storagePath).data.publicUrl;
  return NextResponse.json({ recording: { ...data, public_url: publicUrl } }, { status: 201 });
}

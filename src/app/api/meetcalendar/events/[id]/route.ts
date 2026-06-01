import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";

type UserRow = { id: string; email: string; name: string; google_access_token: string | null };

async function resolveUser(email: string): Promise<UserRow | null> {
  const { data } = await getSupabase()
    .from("users")
    .select("id, email, name, google_access_token")
    .eq("email", email)
    .single();
  return data as UserRow | null;
}

async function patchGcal(token: string, googleEventId: string, patch: Record<string, unknown>) {
  const gcalPatch: Record<string, unknown> = {};
  if (patch.title       !== undefined) gcalPatch.summary     = patch.title;
  if (patch.description !== undefined) gcalPatch.description = patch.description;
  if (patch.location    !== undefined) gcalPatch.location    = patch.location;
  if (patch.start_at    !== undefined) {
    gcalPatch.start = patch.all_day
      ? { date: String(patch.start_at).split("T")[0] }
      : { dateTime: patch.start_at, timeZone: "UTC" };
  }
  if (patch.end_at !== undefined && patch.end_at) {
    gcalPatch.end = patch.all_day
      ? { date: String(patch.end_at).split("T")[0] }
      : { dateTime: patch.end_at, timeZone: "UTC" };
  }
  if (Object.keys(gcalPatch).length === 0) return;

  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
    {
      method:  "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body:    JSON.stringify(gcalPatch),
    },
  );
}

async function deleteGcal(token: string, googleEventId: string) {
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const user = await resolveUser(session.user.email);
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const allowed = ["title","description","location","type","start_at","end_at","all_day","color","notify_email","notify_minutes"];
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (body[key] !== undefined) patch[key] = body[key];
  }

  const { data, error } = await getSupabase()
    .from("calendar_events")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mirror change in Google Calendar
  if (user.google_access_token && data.google_event_id) {
    await patchGcal(user.google_access_token, data.google_event_id, patch);
  }

  return NextResponse.json({ event: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const user = await resolveUser(session.user.email);
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { id } = await params;

  // Fetch event to get google_event_id before deleting
  const { data: ev } = await getSupabase()
    .from("calendar_events")
    .select("google_event_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  const { error } = await getSupabase()
    .from("calendar_events")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mirror deletion in Google Calendar
  if (user.google_access_token && ev?.google_event_id) {
    await deleteGcal(user.google_access_token, ev.google_event_id);
  }

  return NextResponse.json({ success: true });
}

// Send notification email for an event
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const user = await resolveUser(session.user.email);
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { id } = await params;
  const { data: ev, error } = await getSupabase()
    .from("calendar_events")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !ev) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  const startDate = new Date(ev.start_at);
  const dateStr   = startDate.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const timeStr   = ev.all_day ? "Todo el día" : startDate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

  try {
    await sendEmail({
      to:      user.email,
      subject: `Recordatorio: ${ev.title}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <div style="background:#050040;border-radius:12px;padding:20px 24px;margin-bottom:20px">
            <h1 style="color:white;margin:0;font-size:20px">${ev.title}</h1>
            <p style="color:rgba(255,255,255,0.7);margin:6px 0 0;font-size:14px">${dateStr} · ${timeStr}</p>
          </div>
          ${ev.location    ? `<p style="margin:0 0 12px;color:#374151"><strong>📍 Ubicación:</strong> ${ev.location}</p>` : ""}
          ${ev.description ? `<p style="margin:0;color:#374151">${ev.description}</p>` : ""}
          <hr style="margin:20px 0;border:none;border-top:1px solid #e5e7eb"/>
          <p style="color:#9ca3af;font-size:12px;margin:0">
            Recordatorio enviado por MeetBox ${ev.notify_minutes} minuto(s) antes del evento.
          </p>
        </div>
      `,
    });
  } catch {
    return NextResponse.json({ error: "No se pudo enviar el email" }, { status: 500 });
  }

  return NextResponse.json({ sent: true });
}

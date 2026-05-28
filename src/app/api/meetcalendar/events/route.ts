import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

async function resolveUser(email: string) {
  const { data } = await getSupabase()
    .from("users")
    .select("id, google_access_token")
    .eq("email", email)
    .single();
  return data as { id: string; google_access_token: string | null } | null;
}

async function pushToGcal(token: string, ev: {
  title: string; description: string | null; location: string | null;
  start_at: string; end_at: string | null; all_day: boolean;
}): Promise<string | null> {
  const start = ev.all_day
    ? { date: ev.start_at.split("T")[0] }
    : { dateTime: ev.start_at, timeZone: "UTC" };
  const end = ev.end_at
    ? ev.all_day
      ? { date: ev.end_at.split("T")[0] }
      : { dateTime: ev.end_at, timeZone: "UTC" }
    : ev.all_day
      ? { date: ev.start_at.split("T")[0] }
      : { dateTime: new Date(new Date(ev.start_at).getTime() + 3600_000).toISOString(), timeZone: "UTC" };

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body:    JSON.stringify({
        summary:     ev.title,
        description: ev.description ?? undefined,
        location:    ev.location    ?? undefined,
        start, end,
      }),
    },
  );
  if (!res.ok) return null;
  const data = await res.json() as { id: string };
  return data.id ?? null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const user = await resolveUser(session.user.email);
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const start = req.nextUrl.searchParams.get("start");
  const end   = req.nextUrl.searchParams.get("end");

  let query = getSupabase()
    .from("calendar_events")
    .select("*")
    .eq("user_id", user.id)
    .order("start_at", { ascending: true });

  if (start) query = query.gte("start_at", start);
  if (end)   query = query.lte("start_at", end);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const user = await resolveUser(session.user.email);
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const {
    title, description = null, location = null,
    type = "meeting", start_at, end_at = null,
    all_day = false, color = "#050040",
    notify_email = false, notify_minutes = 15,
  } = body;

  if (!title || !start_at) return NextResponse.json({ error: "title y start_at son requeridos" }, { status: 400 });

  // Push to Google Calendar if token available
  let google_event_id: string | null = null;
  if (user.google_access_token) {
    google_event_id = await pushToGcal(user.google_access_token, {
      title: String(title).trim(), description, location, start_at, end_at, all_day,
    });
  }

  const { data, error } = await getSupabase()
    .from("calendar_events")
    .insert({
      user_id: user.id,
      title:   String(title).trim(),
      description: description ? String(description) : null,
      location:    location    ? String(location)    : null,
      type,
      start_at,
      end_at:         end_at || null,
      all_day,
      color,
      notify_email,
      notify_minutes,
      google_event_id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ event: data }, { status: 201 });
}

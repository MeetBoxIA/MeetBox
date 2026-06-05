import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

type CalEventRow = {
  id:          string;
  title:       string;
  description: string | null;
  location:    string | null;
  start_at:    string;
  end_at:      string | null;
  all_day:     boolean;
};

function toGcalEvent(ev: CalEventRow) {
  const start = ev.all_day
    ? { date: ev.start_at.split("T")[0] }
    : { dateTime: ev.start_at };

  const end = ev.end_at
    ? ev.all_day
      ? { date: ev.end_at.split("T")[0] }
      : { dateTime: ev.end_at }
    : ev.all_day
      ? { date: ev.start_at.split("T")[0] }
      : { dateTime: new Date(new Date(ev.start_at).getTime() + 3600_000).toISOString() };

  return {
    summary:     ev.title,
    description: ev.description ?? undefined,
    location:    ev.location    ?? undefined,
    start,
    end,
  };
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: userRow } = await getSupabase()
    .from("users")
    .select("id, google_access_token")
    .eq("email", session.user.email)
    .single();

  if (!userRow) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (!userRow.google_access_token) return NextResponse.json({ error: "no_token" }, { status: 400 });

  const token = userRow.google_access_token as string;

  // ── Step 1: Push local events (without google_event_id) to Google Calendar ──
  const { data: localEvents } = await getSupabase()
    .from("calendar_events")
    .select("id, title, description, location, start_at, end_at, all_day")
    .eq("user_id", userRow.id)
    .is("google_event_id", null);

  let pushed = 0;
  for (const ev of (localEvents ?? []) as CalEventRow[]) {
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body:    JSON.stringify(toGcalEvent(ev)),
      },
    );
    if (res.ok) {
      const gcEv = await res.json() as { id: string };
      await getSupabase()
        .from("calendar_events")
        .update({ google_event_id: gcEv.id })
        .eq("id", ev.id);
      pushed++;
    }
  }

  // ── Step 2: Pull Google Calendar events (3 months back → 6 months ahead) ───
  const threeMonthsAgo = new Date(Date.now() - 90  * 24 * 60 * 60 * 1000).toISOString();
  const sixMonthsLater = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();

  const gcalRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
    `timeMin=${encodeURIComponent(threeMonthsAgo)}&timeMax=${encodeURIComponent(sixMonthsLater)}` +
    `&singleEvents=true&orderBy=startTime&maxResults=500`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  // Token expired or missing calendar scope → clear stale token
  if (gcalRes.status === 401 || gcalRes.status === 403) {
    await getSupabase()
      .from("users")
      .update({ google_access_token: null, google_refresh_token: null, google_token_expiry: null })
      .eq("id", userRow.id);
    return NextResponse.json({ error: "no_token" }, { status: 400 });
  }

  if (!gcalRes.ok) {
    const err = await gcalRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: (err as { error?: { message?: string } }).error?.message ?? "Error al conectar con Google Calendar" },
      { status: 500 },
    );
  }

  const gcalItems: Record<string, unknown>[] = (await gcalRes.json()).items ?? [];

  if (gcalItems.length > 0) {
    const toUpsert = gcalItems.map((ev) => {
      const start = ev.start as { dateTime?: string; date?: string };
      const end   = ev.end   as { dateTime?: string; date?: string };
      return {
        user_id:         userRow.id,
        title:           String(ev.summary ?? "Sin título"),
        description:     (ev.description as string | undefined) ?? null,
        location:        (ev.location    as string | undefined) ?? null,
        type:            "meeting",
        start_at:        start.dateTime  ?? `${start.date}T00:00:00Z`,
        end_at:          end?.dateTime   ?? (end?.date ? `${end.date}T23:59:59Z` : null),
        all_day:         !start.dateTime,
        color:           "#1A73E8",
        notify_email:    false,
        notify_minutes:  15,
        google_event_id: String(ev.id ?? ""),
      };
    });

    const { error } = await getSupabase()
      .from("calendar_events")
      .upsert(toUpsert, { onConflict: "google_event_id" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ synced: gcalItems.length, pushed });
}

/**
 * /api/meetcalendar/events
 *
 * GET  — fetch events for a given date range, expanding recurring series
 *         into individual virtual instances on the server.
 * POST — create a new event; optionally push to Google Calendar if the user
 *         has a linked Google access token.
 *
 * Recurring events are stored as a single row with recurrence_freq/days/until.
 * The GET handler expands them into virtual instances so the client calendar
 * component can render each occurrence without any extra logic.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

interface DbEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  type: string;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  color: string;
  notify_email: boolean;
  notify_minutes: number;
  google_event_id: string | null;
  room_id: string | null;
  recurrence_freq:  "daily" | "weekly" | null;
  recurrence_days:  number[] | null;
  recurrence_until: string | null;
}

/** Look up the user's internal ID and Google token in one query. */
async function resolveUser(email: string) {
  const { data } = await getSupabase()
    .from("users")
    .select("id, google_access_token")
    .eq("email", email)
    .single();
  return data as { id: string; google_access_token: string | null } | null;
}

/**
 * Push a new event to Google Calendar's primary calendar.
 * Uses the short-lived google_access_token stored per user.
 * Returns the Google event ID on success, or null on failure (silently ignored).
 */
async function pushToGcal(token: string, ev: {
  title: string; description: string | null; location: string | null;
  start_at: string; end_at: string | null; all_day: boolean;
}): Promise<string | null> {
  // Google Calendar requires `date` for all-day events and `dateTime` for timed ones
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

/**
 * Expand a recurring event into virtual instances within [rangeStart, rangeEnd].
 * Instances are not persisted — they share the original event's id but have
 * shifted start_at/end_at values, which is enough for calendar rendering.
 * ECB is safe here because we always encrypt exactly one block.
 *
 * Handles:
 *   - daily recurrence: every day from origStart
 *   - weekly recurrence: specific weekdays (0=Mon … 6=Sun)
 *   - optional until date (series ends on recurrence_until)
 *   - safety cap of 800 occurrences to prevent infinite loops
 */
function expandRecurrence(ev: DbEvent, rangeStart: Date, rangeEnd: Date): DbEvent[] {
  if (!ev.recurrence_freq) return [ev];

  const out: DbEvent[] = [];
  const origStart = new Date(ev.start_at);
  const origEnd   = ev.end_at ? new Date(ev.end_at) : null;
  const duration  = origEnd ? origEnd.getTime() - origStart.getTime() : 0;
  const until     = ev.recurrence_until ? new Date(ev.recurrence_until) : null;

  // Cap expansion at the earlier of recurrence_until and rangeEnd
  const cap = until && until < rangeEnd ? until : rangeEnd;

  const cursor = new Date(origStart);
  // Fast-forward the cursor if origStart is far before rangeStart to avoid
  // iterating through months of irrelevant dates one day at a time.
  if (cursor < rangeStart) {
    const diffDays = Math.floor((rangeStart.getTime() - cursor.getTime()) / 86400000);
    cursor.setDate(cursor.getDate() + Math.max(0, diffDays - 1));
  }

  // For weekly recurrence, default to the same weekday as the series start
  const weeklyDays =
    ev.recurrence_freq === "weekly"
      ? (ev.recurrence_days && ev.recurrence_days.length > 0
          ? ev.recurrence_days
          : [((origStart.getDay() + 6) % 7)]) // Sunday=0 in JS → convert to Mon=0
      : null;

  let i = 0;
  const MAX_OCCURRENCES = 800;

  while (cursor <= cap && i++ < MAX_OCCURRENCES) {
    let matches = false;
    if (ev.recurrence_freq === "daily") {
      matches = cursor >= origStart;
    } else if (ev.recurrence_freq === "weekly" && weeklyDays) {
      // JS getDay() returns 0=Sun; we use 0=Mon internally → shift by 6 then mod 7
      const wd = (cursor.getDay() + 6) % 7;
      matches = cursor >= origStart && weeklyDays.includes(wd);
    }

    if (matches && cursor >= rangeStart) {
      const startMs = cursor.getTime();
      out.push({
        ...ev,
        start_at: new Date(startMs).toISOString(),
        end_at:   duration ? new Date(startMs + duration).toISOString() : null,
      });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return out;
}

/** GET — return one-time events + expanded recurring occurrences in range. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const user = await resolveUser(session.user.email);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const start   = req.nextUrl.searchParams.get("start");
  const end     = req.nextUrl.searchParams.get("end");
  const room_id = req.nextUrl.searchParams.get("room_id");

  // ── Query 1: one-time events in range
  let oneTime = getSupabase()
    .from("calendar_events")
    .select("*")
    .eq("user_id", user.id)
    .is("recurrence_freq", null);
  if (start)   oneTime = oneTime.gte("start_at", start);
  if (end)     oneTime = oneTime.lte("start_at", end);
  if (room_id) oneTime = oneTime.eq("room_id", room_id);

  // ── Query 2: recurring series whose occurrences could fall in the range
  // We fetch entire series and expand them in memory; this is intentional
  // because storing pre-expanded instances would waste DB space and make
  // edits (change all future occurrences) very complex.
  let recurring = getSupabase()
    .from("calendar_events")
    .select("*")
    .eq("user_id", user.id)
    .not("recurrence_freq", "is", null);
  // A series can only emit occurrences from its own start_at onward
  if (end) recurring = recurring.lte("start_at", end);
  // Skip series whose explicit end date has already passed
  if (start) recurring = recurring.or(`recurrence_until.is.null,recurrence_until.gte.${start}`);
  if (room_id) recurring = recurring.eq("room_id", room_id);

  const [oneRes, recRes] = await Promise.all([oneTime, recurring]);
  if (oneRes.error) return NextResponse.json({ error: oneRes.error.message }, { status: 500 });
  if (recRes.error) return NextResponse.json({ error: recRes.error.message }, { status: 500 });

  const rangeStart = start ? new Date(start) : new Date(0);
  const rangeEnd   = end   ? new Date(end)   : new Date(Date.now() + 365 * 24 * 3600_000);

  const expanded = (recRes.data as DbEvent[]).flatMap((ev) => expandRecurrence(ev, rangeStart, rangeEnd));
  const all      = [...(oneRes.data as DbEvent[]), ...expanded]
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  return NextResponse.json({ events: all });
}

/** POST — create a new event and optionally sync it to Google Calendar. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const user = await resolveUser(session.user.email);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const {
    title, description = null, location = null,
    type = "meeting", start_at, end_at = null,
    all_day = false, color = "#050040",
    notify_email = false, notify_minutes = 15,
    room_id = null,
    recurrence_freq  = null,
    recurrence_days  = null,
    recurrence_until = null,
  } = body;

  if (!title || !start_at) return NextResponse.json({ error: "title and start_at are required" }, { status: 400 });

  // Skip Google Calendar sync for recurring events — RRULE mapping is not implemented
  let google_event_id: string | null = null;
  if (user.google_access_token && !recurrence_freq) {
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
      room_id: room_id || null,
      recurrence_freq,
      recurrence_days,
      recurrence_until,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ event: data }, { status: 201 });
}

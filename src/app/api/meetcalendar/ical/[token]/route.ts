import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}
function fold(line: string): string {
  const out: string[] = [];
  while (line.length > 74) { out.push(line.slice(0, 74)); line = " " + line.slice(74); }
  out.push(line);
  return out.join("\r\n");
}
function toIcalDt(iso: string, allDay: boolean): string {
  if (allDay) return "VALUE=DATE:" + iso.split("T")[0].replace(/-/g, "");
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth()+1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const { data: user } = await getSupabase()
    .from("users")
    .select("id, name")
    .eq("calendar_share_token", token)
    .single();

  if (!user) {
    return new NextResponse("Calendario no encontrado", { status: 404 });
  }

  const { data: events } = await getSupabase()
    .from("calendar_events")
    .select("id, title, description, location, start_at, end_at, all_day")
    .eq("user_id", user.id)
    .order("start_at", { ascending: true });

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MeetBox//MeetCalendar//ES",
    fold(`X-WR-CALNAME:${esc(user.name)} · MeetBox`),
    "X-WR-TIMEZONE:UTC",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const ev of events ?? []) {
    const uid = `${ev.id}@meetbox.app`;
    const dtStart = toIcalDt(ev.start_at, ev.all_day);
    const dtEnd   = ev.end_at
      ? toIcalDt(ev.end_at, ev.all_day)
      : ev.all_day
        ? toIcalDt(ev.start_at, true)
        : toIcalDt(new Date(new Date(ev.start_at).getTime() + 3600_000).toISOString(), false);

    lines.push("BEGIN:VEVENT");
    lines.push(fold(`UID:${uid}`));
    lines.push(fold(`DTSTART;${dtStart}`));
    lines.push(fold(`DTEND;${dtEnd}`));
    lines.push(fold(`SUMMARY:${esc(ev.title)}`));
    if (ev.description) lines.push(fold(`DESCRIPTION:${esc(ev.description)}`));
    if (ev.location)    lines.push(fold(`LOCATION:${esc(ev.location)}`));
    lines.push(`DTSTAMP:${toIcalDt(new Date().toISOString(), false)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type":        "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="meetbox-${token.slice(0, 8)}.ics"`,
      "Cache-Control":       "no-cache",
    },
  });
}

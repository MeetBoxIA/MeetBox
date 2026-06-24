// ─────────────────────────────────────────────────────────────────────────────
// CalendarMatchingService — finds which calendar event a recording belongs to.
//
// Scores every same-day event 0-100 using a weighted blend of four signals:
//   • name         (40%) — token overlap between meeting title and event title
//   • time         (30%) — proximity of recording time to the event start
//   • participants  (15%) — overlap of mentioned people with event attendees
//   • content      (15%) — keyword overlap between transcript and event title/desc
// The top candidate is auto-selected; all candidates are persisted.
// ─────────────────────────────────────────────────────────────────────────────

import { getSupabase } from "../supabase";
import { CalendarMatchesRepo } from "../repositories/pipeline-repo";
import type { Logger } from "../logger";
import type { CalendarMatch, AnalysisResult } from "../types/pipeline";

const WEIGHTS = { name: 0.40, time: 0.30, participants: 0.15, content: 0.15 };

export class CalendarMatchingService {
  constructor(private log: Logger) {}

  async match(input: {
    userId: string; recordingId: string;
    meetingTitle: string; recordedAt: string; transcript: string;
    mentions: AnalysisResult["mentions"];
  }): Promise<CalendarMatch | null> {
    const recordedTs = new Date(input.recordedAt).getTime();
    const dayStart   = new Date(input.recordedAt); dayStart.setHours(0, 0, 0, 0);
    const dayEnd     = new Date(input.recordedAt); dayEnd.setHours(23, 59, 59, 999);

    // Pull same-day events for the user.
    const { data: events } = await getSupabase()
      .from("calendar_events")
      .select("id, title, description, start_at, end_at")
      .eq("user_id", input.userId)
      .gte("start_at", dayStart.toISOString())
      .lte("start_at", dayEnd.toISOString());

    if (!events?.length) {
      this.log.info("calendar match: no same-day events");
      return null;
    }

    // Collect attendee names per event (best-effort; table may be empty).
    const eventIds = events.map((e) => e.id);
    const { data: attendees } = await getSupabase()
      .from("calendar_event_attendees")
      .select("event_id, name, email")
      .in("event_id", eventIds);
    const attendeesByEvent = new Map<string, string[]>();
    for (const a of attendees ?? []) {
      const list = attendeesByEvent.get(a.event_id) ?? [];
      list.push(`${a.name ?? ""} ${a.email ?? ""}`.toLowerCase());
      attendeesByEvent.set(a.event_id, list);
    }

    const mentionNames = input.mentions.map((m) => m.name.toLowerCase());
    const transcriptLc = input.transcript.toLowerCase();

    const matches: CalendarMatch[] = events.map((ev) => {
      const nameScore    = tokenOverlap(input.meetingTitle, ev.title);
      const timeScore    = timeProximity(recordedTs, new Date(ev.start_at).getTime());
      const partScore    = participantOverlap(mentionNames, attendeesByEvent.get(ev.id) ?? []);
      const contentScore = contentOverlap(transcriptLc, `${ev.title} ${ev.description ?? ""}`);

      const score = Math.round(
        (nameScore * WEIGHTS.name + timeScore * WEIGHTS.time +
         partScore * WEIGHTS.participants + contentScore * WEIGHTS.content) * 100,
      );

      return {
        calendar_event_id: ev.id,
        event_title:       ev.title,
        event_start:       ev.start_at,
        score,
        breakdown: {
          name:         Math.round(nameScore * 100),
          time:         Math.round(timeScore * 100),
          participants: Math.round(partScore * 100),
          content:      Math.round(contentScore * 100),
        },
      };
    }).sort((a, b) => b.score - a.score);

    const top = await CalendarMatchesRepo.persist(input.userId, input.recordingId, matches);
    this.log.info("calendar match: scored events", { count: matches.length, top: top?.score });
    return matches[0] ?? null;
  }
}

// ── Scoring helpers (all return 0..1) ────────────────────────────────────────

function tokenize(s: string): Set<string> {
  return new Set(s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((t) => t.length > 2));
}

/** Jaccard-style token overlap between two titles. */
function tokenOverlap(a: string, b: string): number {
  const ta = tokenize(a), tb = tokenize(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.min(ta.size, tb.size);
}

/** 1.0 when the recording starts at the event time, decaying over ~2 hours. */
function timeProximity(recordedTs: number, eventTs: number): number {
  const diffMin = Math.abs(recordedTs - eventTs) / 60000;
  if (diffMin <= 5)  return 1;
  if (diffMin >= 120) return 0;
  return 1 - diffMin / 120;
}

/** Fraction of mentioned people that appear in the event attendee list. */
function participantOverlap(mentions: string[], attendees: string[]): number {
  if (!mentions.length || !attendees.length) return 0;
  const blob = attendees.join(" ");
  const hits = mentions.filter((m) => m && blob.includes(m.split(" ")[0])).length;
  return hits / mentions.length;
}

/** Keyword overlap between the transcript and the event title/description. */
function contentOverlap(transcriptLc: string, eventText: string): number {
  const tokens = tokenize(eventText);
  if (!tokens.size) return 0;
  let hits = 0;
  for (const t of tokens) if (transcriptLc.includes(t)) hits++;
  return hits / tokens.size;
}

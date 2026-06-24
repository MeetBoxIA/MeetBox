// ─────────────────────────────────────────────────────────────────────────────
// Repository layer for the meeting pipeline.
//
// Centralizes all Supabase access for the pipeline tables so services never
// touch the DB client directly. Every method is scoped to a user_id where the
// table is user-owned, keeping the data-isolation guarantee in one place.
// ─────────────────────────────────────────────────────────────────────────────

import { getSupabase } from "../supabase";
import { JOB_STATUS_ORDER, type JobStatus, type AnalysisResult, type CalendarMatch } from "../types/pipeline";

// Map a status to a progress percentage (uploaded=0 … completed=100).
function progressFor(status: JobStatus): number {
  if (status === "failed") return 100;
  const idx = JOB_STATUS_ORDER.indexOf(status);
  if (idx < 0) return 0;
  return Math.round((idx / (JOB_STATUS_ORDER.length - 1)) * 100);
}

// ── Recordings ───────────────────────────────────────────────────────────────
export const RecordingsRepo = {
  async create(input: {
    userId: string; title: string; fileName: string; fileSize: number;
    mimeType: string; storagePath: string; durationSeconds?: number; source?: string;
  }) {
    const { data, error } = await getSupabase()
      .from("meeting_recordings")
      .insert({
        user_id:           input.userId,
        title:             input.title,
        file_name:         input.fileName,
        file_size:         input.fileSize,
        mime_type:         input.mimeType,
        storage_path:      input.storagePath,
        duration_seconds:  input.durationSeconds ?? null,
        source:            input.source ?? "desktop",
        status:            "ready",
        processing_status: "pending",
      })
      .select("id, storage_path").single();
    if (error) throw new Error(`RecordingsRepo.create: ${error.message}`);
    return data;
  },

  async setProcessingStatus(id: string, status: string) {
    await getSupabase().from("meeting_recordings").update({ processing_status: status }).eq("id", id);
  },

  /** Download the raw audio bytes from Supabase Storage. */
  async download(storagePath: string): Promise<Blob> {
    const { data, error } = await getSupabase().storage.from("recordings").download(storagePath);
    if (error || !data) throw new Error(`RecordingsRepo.download: ${error?.message ?? "no data"}`);
    return data;
  },
};

// ── Processing jobs (state machine) ──────────────────────────────────────────
export const JobsRepo = {
  async create(input: { userId: string; recordingId: string; correlationId: string; desktopSessionId?: string }) {
    const { data, error } = await getSupabase()
      .from("meeting_processing_jobs")
      .insert({
        user_id:            input.userId,
        recording_id:       input.recordingId,
        correlation_id:     input.correlationId,
        desktop_session_id: input.desktopSessionId ?? null,
        status:             "uploaded",
        progress_pct:       0,
      })
      .select("*").single();
    if (error) throw new Error(`JobsRepo.create: ${error.message}`);
    return data;
  },

  /** Transition the job to a new status; auto-computes progress + timestamps. */
  async transition(jobId: string, status: JobStatus, extra: Record<string, unknown> = {}) {
    const patch: Record<string, unknown> = {
      status,
      progress_pct: progressFor(status),
      updated_at:   new Date().toISOString(),
      ...extra,
    };
    if (status === "queued")    patch.started_at   = new Date().toISOString();
    if (status === "completed" || status === "failed") patch.completed_at = new Date().toISOString();

    const { data, error } = await getSupabase()
      .from("meeting_processing_jobs").update(patch).eq("id", jobId)
      .select("*").single();
    if (error) throw new Error(`JobsRepo.transition: ${error.message}`);
    return data;
  },

  async fail(jobId: string, step: string, message: string) {
    await getSupabase().from("meeting_processing_jobs").update({
      status: "failed", progress_pct: 100, error_step: step,
      last_error: message, completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", jobId);
  },

  async incrementAttempts(jobId: string) {
    // Read-modify-write; acceptable for low-frequency retries.
    const { data } = await getSupabase().from("meeting_processing_jobs").select("attempts").eq("id", jobId).single();
    await getSupabase().from("meeting_processing_jobs")
      .update({ attempts: (data?.attempts ?? 0) + 1 }).eq("id", jobId);
  },

  async getById(jobId: string, userId: string) {
    const { data } = await getSupabase()
      .from("meeting_processing_jobs").select("*").eq("id", jobId).eq("user_id", userId).maybeSingle();
    return data;
  },
};

// ── Transcripts ──────────────────────────────────────────────────────────────
export const TranscriptsRepo = {
  async create(input: {
    userId: string; recordingId: string; jobId: string;
    fullText: string; language: string | null; durationSeconds: number | null;
    segments?: unknown[]; provider?: string;
  }) {
    const wordCount = input.fullText.trim().split(/\s+/).filter(Boolean).length;
    const { data, error } = await getSupabase()
      .from("meeting_transcripts")
      .insert({
        user_id:          input.userId,
        recording_id:     input.recordingId,
        job_id:           input.jobId,
        full_text:        input.fullText,
        language:         input.language,
        duration_seconds: input.durationSeconds,
        word_count:       wordCount,
        provider:         input.provider ?? "openai-whisper",
        segments:         input.segments ?? [],
      })
      .select("id").single();
    if (error) throw new Error(`TranscriptsRepo.create: ${error.message}`);
    return data;
  },
};

// ── Analysis + normalized children ───────────────────────────────────────────
export const AnalysisRepo = {
  /**
   * Persist a full analysis result as NORMALIZED rows (not just JSON):
   * one meeting_analysis parent + summary + decisions + risks + mentions.
   * Returns the analysis id and the created counts.
   */
  async persist(input: {
    userId: string; recordingId: string; transcriptId: string; jobId: string;
    result: AnalysisResult; model?: string; tokensUsed?: number;
  }) {
    const db = getSupabase();
    const { result } = input;

    const { data: analysis, error: aErr } = await db
      .from("meeting_analysis")
      .insert({
        user_id:         input.userId,
        recording_id:    input.recordingId,
        transcript_id:   input.transcriptId,
        job_id:          input.jobId,
        model:           input.model ?? "gpt-4o-mini",
        tokens_used:     input.tokensUsed ?? null,
        tasks_count:     result.tasks.length,
        decisions_count: result.decisions.length,
        risks_count:     result.risks.length,
        mentions_count:  result.mentions.length,
      })
      .select("id").single();
    if (aErr || !analysis) throw new Error(`AnalysisRepo.persist(analysis): ${aErr?.message}`);

    const analysisId = analysis.id;

    // Summary (one row)
    await db.from("meeting_summaries").insert({
      analysis_id: analysisId, user_id: input.userId,
      summary: result.summary, headline: result.headline, next_steps: result.next_steps,
    });

    // Decisions
    if (result.decisions.length) {
      await db.from("meeting_decisions").insert(
        result.decisions.map((d, i) => ({
          analysis_id: analysisId, user_id: input.userId,
          title: d.title, detail: d.detail, decided_by: d.decided_by, sort_order: i,
        })),
      );
    }

    // Risks
    if (result.risks.length) {
      await db.from("meeting_risks").insert(
        result.risks.map((r, i) => ({
          analysis_id: analysisId, user_id: input.userId,
          title: r.title, detail: r.detail, severity: r.severity, owner_name: r.owner, sort_order: i,
        })),
      );
    }

    // Mentions — resolve to real users by name match where possible.
    if (result.mentions.length) {
      await db.from("meeting_mentions").insert(
        result.mentions.map((m) => ({
          analysis_id: analysisId, user_id: input.userId,
          name: m.name, mention_count: m.count,
        })),
      );
    }

    return { analysisId, counts: {
      tasks: result.tasks.length, decisions: result.decisions.length,
      risks: result.risks.length, mentions: result.mentions.length,
    }};
  },
};

// ── Calendar matches ─────────────────────────────────────────────────────────
export const CalendarMatchesRepo = {
  async persist(userId: string, recordingId: string, matches: CalendarMatch[]) {
    if (!matches.length) return null;
    const db = getSupabase();
    // Highest score is auto-selected.
    const top = matches[0];
    await db.from("meeting_calendar_matches").insert(
      matches.map((m) => ({
        user_id:           userId,
        recording_id:      recordingId,
        calendar_event_id: m.calendar_event_id,
        score:             m.score,
        score_breakdown:   m.breakdown,
        is_selected:       m.calendar_event_id === top.calendar_event_id,
      })),
    );
    return top;
  },
};

// ── MeetAction session + items (bridges into existing meet_action_* tables) ───
export const MeetActionRepo = {
  /**
   * Create the reviewable MeetAction session from a completed analysis,
   * plus one action item per detected task / decision / risk / next step.
   */
  async createFromAnalysis(input: {
    userId: string; recordingId: string; jobId: string; transcriptId: string;
    analysisId: string; correlationId: string;
    meetingName: string; meetingDate: string | null; durationSeconds: number | null;
    summary: string; result: AnalysisResult;
    calendarMatch: CalendarMatch | null;
  }) {
    const db = getSupabase();
    const { result } = input;

    const { data: session, error: sErr } = await db
      .from("meet_action_sessions")
      .insert({
        user_id:            input.userId,
        recording_id:       input.recordingId,
        job_id:             input.jobId,
        transcript_id:      input.transcriptId,
        analysis_id:        input.analysisId,
        correlation_id:     input.correlationId,
        calendar_event_id:  input.calendarMatch?.calendar_event_id ?? null,
        calendar_match_pct: input.calendarMatch?.score ?? null,
        meeting_name:       input.meetingName,
        meeting_date:       input.meetingDate,
        duration_seconds:   input.durationSeconds,
        status:             "pending_review",
        summary_ai:         input.summary,
        decisions_count:    result.decisions.length,
        tasks_count:        result.tasks.length,
        risks_count:        result.risks.length,
        next_steps_count:   result.next_steps.length,
        people_mentioned:   result.mentions.map((m) => m.name),
        risks_detected:     result.risks.map((r) => ({ title: r.title, severity: r.severity, description: r.detail })),
      })
      .select("id").single();
    if (sErr || !session) throw new Error(`MeetActionRepo.createFromAnalysis: ${sErr?.message}`);

    const sessionId = session.id;

    // Build action items from each entity type.
    type ItemInsert = {
      session_id: string; user_id: string; type: string; destination: string;
      status: string; title: string; description: string | null;
      assignee_name: string | null; priority: string; sort_order: number;
    };
    const items: ItemInsert[] = [];
    let order = 0;

    for (const task of result.tasks) {
      items.push({
        session_id: sessionId, user_id: input.userId, type: "task",
        destination: task.destination, status: "pending",
        title: task.title, description: task.description,
        assignee_name: task.assignee, priority: task.priority, sort_order: order++,
      });
    }
    for (const d of result.decisions) {
      items.push({
        session_id: sessionId, user_id: input.userId, type: "decision",
        destination: "notion", status: "pending",
        title: d.title, description: d.detail,
        assignee_name: d.decided_by, priority: "medium", sort_order: order++,
      });
    }
    for (const r of result.risks) {
      items.push({
        session_id: sessionId, user_id: input.userId, type: "risk",
        destination: "slack", status: "pending",
        title: r.title, description: r.detail,
        assignee_name: r.owner, priority: r.severity === "critical" ? "critical" : "high", sort_order: order++,
      });
    }
    for (const step of result.next_steps) {
      items.push({
        session_id: sessionId, user_id: input.userId, type: "next_step",
        destination: "meetcalendar", status: "pending",
        title: step, description: null, assignee_name: null, priority: "medium", sort_order: order++,
      });
    }

    if (items.length) await db.from("meet_action_items").insert(items);

    return { sessionId, itemCount: items.length };
  },
};

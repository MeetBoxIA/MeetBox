// ─────────────────────────────────────────────────────────────────────────────
// Shared TypeScript types for the Desktop → Backend → MeetAction pipeline.
// These mirror the columns defined in supabase/desktop_pipeline_migration.sql.
// ─────────────────────────────────────────────────────────────────────────────

export type JobStatus =
  | "uploaded"
  | "queued"
  | "transcribing"
  | "analyzing"
  | "matching_calendar"
  | "creating_actions"
  | "completed"
  | "failed";

// Ordered list — also used to compute progress_pct from the current status.
export const JOB_STATUS_ORDER: JobStatus[] = [
  "uploaded",
  "queued",
  "transcribing",
  "analyzing",
  "matching_calendar",
  "creating_actions",
  "completed",
];

export type MeetingEventType =
  | "meeting.processing.updated"
  | "meeting.transcription.completed"
  | "meeting.analysis.completed"
  | "meeting.calendar.matched"
  | "meeting.actions.created"
  | "meeting.completed"
  | "meeting.failed";

export type Severity     = "low" | "medium" | "high" | "critical";
export type ActionType   = "task" | "decision" | "risk" | "next_step" | "event" | "note";
export type Destination  = "jira" | "slack" | "notion" | "teams" | "meetcalendar" | "meetbook" | "zoom";
export type Priority     = "low" | "medium" | "high" | "critical";

// ── Records ──────────────────────────────────────────────────────────────────
export interface DesktopSession {
  id:           string;
  user_id:      string;
  token_prefix: string;
  device_label: string | null;
  platform:     string | null;
  app_version:  string | null;
  created_at:   string;
  expires_at:   string;
  last_used_at: string | null;
  revoked_at:   string | null;
}

export interface ProcessingJob {
  id:             string;
  user_id:        string;
  recording_id:   string;
  correlation_id: string;
  status:         JobStatus;
  progress_pct:   number;
  transcript_id:  string | null;
  analysis_id:    string | null;
  session_id:     string | null;
  attempts:       number;
  last_error:     string | null;
  error_step:     string | null;
  created_at:     string;
  started_at:     string | null;
  completed_at:   string | null;
}

export interface Transcript {
  id:               string;
  recording_id:     string;
  full_text:        string;
  language:         string | null;
  duration_seconds: number | null;
  word_count:       number;
  segments:         TranscriptSegment[];
}

export interface TranscriptSegment {
  start:   number;
  end:     number;
  text:    string;
  speaker?: string;
}

// ── AI analysis output (the shape the LLM is asked to return) ─────────────────
export interface AnalyzedReminder {
  title:         string;
  deadline_hint: string | null;
}

export interface AnalysisResult {
  headline:    string;
  summary:     string;
  next_steps:  string[];
  tasks:       AnalyzedTask[];
  decisions:   AnalyzedDecision[];
  risks:       AnalyzedRisk[];
  mentions:    AnalyzedMention[];
  reminders?:  AnalyzedReminder[];
}

export interface AnalyzedTask {
  title:        string;
  description:  string;
  assignee:     string | null;   // name as spoken in the meeting
  priority:     Priority;
  due_hint:     string | null;   // natural-language date hint, e.g. "next Friday"
  destination:  Destination;     // suggested destination
}

export interface AnalyzedDecision {
  title:      string;
  detail:     string;
  decided_by: string | null;
}

export interface AnalyzedRisk {
  title:    string;
  detail:   string;
  severity: Severity;
  owner:    string | null;
}

export interface AnalyzedMention {
  name:  string;
  count: number;
}

// ── Calendar matching ────────────────────────────────────────────────────────
export interface CalendarMatch {
  calendar_event_id: string;
  event_title:       string;
  event_start:       string;
  score:             number;          // 0-100
  breakdown: {
    name:         number;
    time:         number;
    participants: number;
    content:      number;
  };
}

// ── Upload metadata sent by the desktop client ───────────────────────────────
export interface DesktopUploadMeta {
  title?:            string;
  duration_seconds?: number;
  recorded_at?:      string;          // ISO timestamp when recording started
  platform?:         string;
  app_version?:      string;
  timezone?:         string;
}

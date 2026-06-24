// ─────────────────────────────────────────────────────────────────────────────
// Structured logging + observability for the meeting pipeline.
//
// Every pipeline run carries a correlation_id so all log lines and persisted
// meeting_events for one recording can be traced end-to-end. Logs go to stdout
// as JSON (machine-parseable for any log aggregator) and, when a correlation
// context is provided, are also persisted to the meeting_events audit table.
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID } from "crypto";
import { getSupabase } from "./supabase";
import type { MeetingEventType } from "./types/pipeline";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  correlationId: string;
  userId?:       string;
  jobId?:        string;
  recordingId?:  string;
  sessionId?:    string;
}

/** Generate a new correlation id for a pipeline run. */
export function newCorrelationId(): string {
  return `mtg_${randomUUID()}`;
}

/** Emit a structured JSON log line to stdout. */
function emit(level: LogLevel, ctx: Partial<LogContext>, message: string, data?: Record<string, unknown>) {
  const line = {
    ts:    new Date().toISOString(),
    level,
    msg:   message,
    ...ctx,
    ...(data ? { data } : {}),
  };
  // Single-line JSON keeps it grep-able and aggregator-friendly.
  const serialized = JSON.stringify(line);
  if (level === "error")      console.error(serialized);
  else if (level === "warn")  console.warn(serialized);
  else                        console.log(serialized);
}

/**
 * A scoped logger bound to a correlation context. Use `pipelineLogger(ctx)`
 * at the start of a run and pass it through the services.
 */
export class Logger {
  constructor(private ctx: LogContext) {}

  /** Extend the context (e.g. once a jobId or sessionId becomes known). */
  with(extra: Partial<LogContext>): Logger {
    return new Logger({ ...this.ctx, ...extra });
  }

  debug(msg: string, data?: Record<string, unknown>) { emit("debug", this.ctx, msg, data); }
  info (msg: string, data?: Record<string, unknown>) { emit("info",  this.ctx, msg, data); }
  warn (msg: string, data?: Record<string, unknown>) { emit("warn",  this.ctx, msg, data); }
  error(msg: string, data?: Record<string, unknown>) { emit("error", this.ctx, msg, data); }

  /**
   * Persist a domain event to meeting_events (audit + Realtime source) AND
   * log it. This is the canonical way to record lifecycle milestones.
   */
  async event(
    eventType: MeetingEventType,
    message: string,
    payload: Record<string, unknown> = {},
    level: LogLevel = "info",
  ): Promise<void> {
    emit(level, this.ctx, `event:${eventType} ${message}`, payload);
    if (!this.ctx.userId) return; // events require a user scope
    try {
      await getSupabase().from("meeting_events").insert({
        user_id:        this.ctx.userId,
        correlation_id: this.ctx.correlationId,
        job_id:         this.ctx.jobId ?? null,
        recording_id:   this.ctx.recordingId ?? null,
        session_id:     this.ctx.sessionId ?? null,
        event_type:     eventType,
        level,
        message,
        payload,
      });
    } catch (e) {
      // Never let observability failures break the pipeline.
      emit("warn", this.ctx, "failed to persist meeting_event", { error: String(e) });
    }
  }
}

export function pipelineLogger(ctx: LogContext): Logger {
  return new Logger(ctx);
}

// ─────────────────────────────────────────────────────────────────────────────
// PipelineOrchestrator — drives a recording through the full state machine:
//
//   queued → transcribing → analyzing → matching_calendar → creating_actions → completed
//
// Each transition: updates the job row (→ Postgres Realtime), persists a
// meeting_event (→ audit + broadcast), and on any error marks the job failed
// and emits meeting.failed. Designed to be invoked AFTER the upload response is
// already sent, so the HTTP request is never blocked.
// ─────────────────────────────────────────────────────────────────────────────

import { JobsRepo, RecordingsRepo, MeetActionRepo } from "../repositories/pipeline-repo";
import { TranscriptionService } from "./transcription-service";
import { MeetingAnalysisService } from "./analysis-service";
import { CalendarMatchingService } from "./calendar-matching-service";
import { RealtimePublisher } from "./realtime-publisher";
import { pipelineLogger, type LogContext } from "../logger";

export interface PipelineInput {
  userId:           string;
  recordingId:      string;
  jobId:            string;
  correlationId:    string;
  storagePath:      string;
  fileName:         string;
  meetingTitle:     string;
  recordedAt:       string;
  durationSeconds:  number | null;
}

export class PipelineOrchestrator {
  /**
   * Run the entire pipeline. Resolves when done (or failed). Callers should
   * NOT await this inside the request handler — fire it and return immediately.
   */
  static async run(input: PipelineInput): Promise<void> {
    const ctx: LogContext = {
      correlationId: input.correlationId,
      userId:        input.userId,
      jobId:         input.jobId,
      recordingId:   input.recordingId,
    };
    const log = pipelineLogger(ctx);

    const publish = (event: Parameters<typeof RealtimePublisher.publish>[1], payload: Record<string, unknown>) =>
      RealtimePublisher.publish(input.userId, event, { jobId: input.jobId, ...payload });

    try {
      log.info("pipeline: started");
      await JobsRepo.incrementAttempts(input.jobId);

      // ── 1. queued ──────────────────────────────────────────────────────────
      await JobsRepo.transition(input.jobId, "queued");
      await publish("meeting.processing.updated", { status: "queued", progress: 14 });

      // ── 2. transcribing ─────────────────────────────────────────────────────
      await JobsRepo.transition(input.jobId, "transcribing");
      await RecordingsRepo.setProcessingStatus(input.recordingId, "transcribing");
      await publish("meeting.processing.updated", { status: "transcribing", progress: 28 });

      const transcription = await new TranscriptionService(log).transcribe({
        userId: input.userId, recordingId: input.recordingId, jobId: input.jobId,
        storagePath: input.storagePath, fileName: input.fileName, durationHint: input.durationSeconds,
      });
      await JobsRepo.transition(input.jobId, "transcribing", { transcript_id: transcription.transcriptId });
      await log.with({ }).event("meeting.transcription.completed", "Transcripción completada", {
        transcriptId: transcription.transcriptId, language: transcription.language,
      });
      await publish("meeting.transcription.completed", { transcriptId: transcription.transcriptId });

      // ── 3. analyzing ─────────────────────────────────────────────────────────
      await JobsRepo.transition(input.jobId, "analyzing");
      await publish("meeting.processing.updated", { status: "analyzing", progress: 42 });

      const { analysisId, result } = await new MeetingAnalysisService(log).analyze({
        userId: input.userId, recordingId: input.recordingId,
        transcriptId: transcription.transcriptId, jobId: input.jobId, transcript: transcription.fullText,
      });
      await JobsRepo.transition(input.jobId, "analyzing", { analysis_id: analysisId });
      await log.event("meeting.analysis.completed", "Análisis IA completado", {
        analysisId, tasks: result.tasks.length, decisions: result.decisions.length,
        risks: result.risks.length, mentions: result.mentions.length,
      });
      await publish("meeting.analysis.completed", { analysisId });

      // ── 4. matching_calendar ────────────────────────────────────────────────
      await JobsRepo.transition(input.jobId, "matching_calendar");
      await publish("meeting.processing.updated", { status: "matching_calendar", progress: 57 });

      const calendarMatch = await new CalendarMatchingService(log).match({
        userId: input.userId, recordingId: input.recordingId,
        meetingTitle: input.meetingTitle, recordedAt: input.recordedAt,
        transcript: transcription.fullText, mentions: result.mentions,
      });
      await log.event("meeting.calendar.matched", "Matching de calendario completado", {
        matched: !!calendarMatch, score: calendarMatch?.score ?? null,
      });

      // ── 5. creating_actions ──────────────────────────────────────────────────
      await JobsRepo.transition(input.jobId, "creating_actions");
      await publish("meeting.processing.updated", { status: "creating_actions", progress: 71 });

      const { sessionId, itemCount } = await MeetActionRepo.createFromAnalysis({
        userId: input.userId, recordingId: input.recordingId, jobId: input.jobId,
        transcriptId: transcription.transcriptId, analysisId, correlationId: input.correlationId,
        meetingName: input.meetingTitle, meetingDate: input.recordedAt,
        durationSeconds: transcription.durationSeconds, summary: result.summary,
        result, calendarMatch,
      });
      await JobsRepo.transition(input.jobId, "creating_actions", { session_id: sessionId });
      await log.with({ sessionId }).event("meeting.actions.created", "Sesión de MeetAction creada", {
        sessionId, itemCount,
      });
      await publish("meeting.actions.created", { sessionId, itemCount });

      // ── 6. completed ─────────────────────────────────────────────────────────
      await JobsRepo.transition(input.jobId, "completed", { session_id: sessionId });
      await RecordingsRepo.setProcessingStatus(input.recordingId, "completed");
      await log.with({ sessionId }).event("meeting.completed", "Procesamiento completado", { sessionId });
      await publish("meeting.completed", { sessionId, status: "completed", progress: 100 });

      log.info("pipeline: completed", { sessionId, itemCount });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const step = await currentStep(input.jobId);
      log.error("pipeline: failed", { step, error: message });
      await JobsRepo.fail(input.jobId, step, message);
      await RecordingsRepo.setProcessingStatus(input.recordingId, "failed");
      await log.event("meeting.failed", "El procesamiento falló", { step, error: message }, "error");
      await publish("meeting.failed", { step, error: message });
    }
  }
}

/** Read the job's current status to label where a failure happened. */
async function currentStep(jobId: string): Promise<string> {
  try {
    const { data } = await (await import("../supabase")).getSupabase()
      .from("meeting_processing_jobs").select("status").eq("id", jobId).single();
    return data?.status ?? "unknown";
  } catch {
    return "unknown";
  }
}

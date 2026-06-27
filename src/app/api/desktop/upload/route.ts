/**
 * POST /api/desktop/upload
 *
 * Receives an audio recording (multipart/form-data) from MeetBox Desktop,
 * stores it in Supabase Storage, creates the recording + processing job rows,
 * fires the async pipeline (without blocking the response), and returns the
 * job id so the client can track progress.
 *
 * Auth: Bearer desktop token (see src/lib/desktop-auth.ts).
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { authenticateDesktopRequest } from "@/lib/desktop-auth";
import { RecordingsRepo, JobsRepo } from "@/lib/repositories/pipeline-repo";
import { PipelineOrchestrator } from "@/lib/services/pipeline-orchestrator";
import { newCorrelationId, pipelineLogger } from "@/lib/logger";
import type { DesktopUploadMeta } from "@/lib/types/pipeline";

const MAX_BYTES      = 200 * 1024 * 1024; // 200 MB cap
const ALLOWED_MIME   = [
  "audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav",
  "audio/x-wav", "audio/flac", "audio/x-m4a",
  "video/webm", "video/mp4",
];
const ALLOWED_EXT_RE = /\.(webm|ogg|mp3|wav|m4a|mp4|flac)$/i;

// CORS for the Electron renderer (it may call directly in addition to the IPC proxy).
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  // ── 1. Authenticate the desktop session ──────────────────────────────────
  const auth = await authenticateDesktopRequest(req);
  if (!auth) {
    return NextResponse.json({ error: "Token de desktop inválido o expirado" }, { status: 401, headers: CORS });
  }

  // ── 2. Parse multipart body ──────────────────────────────────────────────
  let form: FormData;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ error: "Formato multipart inválido" }, { status: 400, headers: CORS }); }

  const file = form.get("file") as File | null;
  const metaRaw = form.get("metadata") as string | null;
  if (!file) return NextResponse.json({ error: "Archivo de audio requerido" }, { status: 400, headers: CORS });

  // ── 3. Validate file ─────────────────────────────────────────────────────
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `El archivo excede el máximo de ${MAX_BYTES / 1048576}MB` }, { status: 413, headers: CORS });
  }
  // A generic/empty MIME (e.g. from a Blob created without an explicit type)
  // is validated by file extension instead of rejecting outright.
  const isGenericMime = !file.type || file.type === "application/octet-stream";
  if (!isGenericMime && !ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: `Formato no soportado: ${file.type}` }, { status: 415, headers: CORS });
  }
  if (isGenericMime && !ALLOWED_EXT_RE.test(file.name)) {
    return NextResponse.json({ error: "Formato no soportado" }, { status: 415, headers: CORS });
  }

  let meta: DesktopUploadMeta = {};
  if (metaRaw) { try { meta = JSON.parse(metaRaw); } catch { /* ignore malformed meta */ } }

  const correlationId = newCorrelationId();
  const log = pipelineLogger({ correlationId, userId: auth.userId });
  log.info("upload: received", { fileName: file.name, size: file.size, mime: file.type });

  // ── 4. Store the audio in Supabase Storage ───────────────────────────────
  const safeName    = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "recording.webm";
  const storagePath = `${auth.userId}/desktop/${Date.now()}-${safeName}`;
  const buffer      = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await getSupabase()
    .storage.from("recordings")
    .upload(storagePath, buffer, { contentType: file.type || "audio/webm", upsert: false });
  if (upErr) {
    log.error("upload: storage failed", { error: upErr.message });
    return NextResponse.json({ error: "Error al almacenar el archivo" }, { status: 500, headers: CORS });
  }

  // ── 5. Create recording + job rows ───────────────────────────────────────
  const title = meta.title?.trim() || defaultTitle(meta.recorded_at);
  let recordingId: string;
  let jobId: string;
  try {
    const recording = await RecordingsRepo.create({
      userId: auth.userId, title, fileName: safeName, fileSize: file.size,
      mimeType: file.type || "audio/webm", storagePath,
      durationSeconds: meta.duration_seconds, source: "desktop",
    });
    recordingId = recording.id;

    const job = await JobsRepo.create({
      userId: auth.userId, recordingId, correlationId, desktopSessionId: auth.sessionId,
    });
    jobId = job.id;
  } catch (e) {
    log.error("upload: db insert failed", { error: String(e) });
    return NextResponse.json({ error: "Error al registrar la grabación" }, { status: 500, headers: CORS });
  }

  log.with({ jobId, recordingId }).event("meeting.processing.updated", "Grabación recibida", { status: "uploaded" });

  // ── 6. Fire the pipeline WITHOUT awaiting (non-blocking response) ─────────
  // In a serverless deploy, swap this for a queue enqueue (e.g. QStash/Inngest).
  void PipelineOrchestrator.run({
    userId: auth.userId, recordingId, jobId, correlationId,
    storagePath, fileName: safeName, meetingTitle: title,
    recordedAt: meta.recorded_at ?? new Date().toISOString(),
    durationSeconds: meta.duration_seconds ?? null,
  });

  // ── 7. Respond immediately with the processing id ────────────────────────
  return NextResponse.json(
    { job_id: jobId, recording_id: recordingId, correlation_id: correlationId, status: "uploaded" },
    { status: 202, headers: CORS },
  );
}

function defaultTitle(recordedAt?: string): string {
  const d = recordedAt ? new Date(recordedAt) : new Date();
  return `Reunión ${d.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} ${d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
}

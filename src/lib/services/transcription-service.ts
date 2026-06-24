// ─────────────────────────────────────────────────────────────────────────────
// TranscriptionService — turns an uploaded audio recording into text.
//
// Uses OpenAI Whisper (whisper-1) when OPENAI_API_KEY is set. Without a key it
// returns a deterministic stub transcript so the rest of the pipeline can run
// end-to-end in development.
// ─────────────────────────────────────────────────────────────────────────────

import { RecordingsRepo, TranscriptsRepo } from "../repositories/pipeline-repo";
import type { Logger } from "../logger";

export interface TranscriptionResult {
  transcriptId:     string;
  fullText:         string;
  language:         string | null;
  durationSeconds:  number | null;
}

interface WhisperVerboseResponse {
  text:     string;
  language: string;
  duration: number;
  segments?: { start: number; end: number; text: string }[];
}

export class TranscriptionService {
  constructor(private log: Logger) {}

  /**
   * Download the audio from storage, transcribe it, and persist the result.
   * @throws on download or API failure (the orchestrator marks the job failed).
   */
  async transcribe(input: {
    userId: string; recordingId: string; jobId: string;
    storagePath: string; fileName: string; durationHint?: number | null;
  }): Promise<TranscriptionResult> {
    this.log.info("transcription: downloading audio", { storagePath: input.storagePath });
    const blob = await RecordingsRepo.download(input.storagePath);

    let fullText: string;
    let language: string | null;
    let duration: number | null = input.durationHint ?? null;
    let segments: unknown[] = [];

    if (process.env.OPENAI_API_KEY) {
      const result = await this.callWhisper(blob, input.fileName);
      fullText = result.text;
      language = result.language ?? null;
      duration = Math.round(result.duration) || duration;
      segments = result.segments ?? [];
    } else {
      this.log.warn("transcription: no OPENAI_API_KEY, using stub transcript");
      fullText = STUB_TRANSCRIPT;
      language = "es";
    }

    const { id } = await TranscriptsRepo.create({
      userId: input.userId, recordingId: input.recordingId, jobId: input.jobId,
      fullText, language, durationSeconds: duration, segments,
    });

    this.log.info("transcription: persisted", { transcriptId: id, words: fullText.split(/\s+/).length });
    return { transcriptId: id, fullText, language, durationSeconds: duration };
  }

  /** Call OpenAI Whisper with the audio blob. */
  private async callWhisper(blob: Blob, fileName: string): Promise<WhisperVerboseResponse> {
    const form = new FormData();
    form.append("file", blob, fileName.endsWith(".webm") ? fileName : `${fileName}.webm`);
    form.append("model", "whisper-1");
    form.append("response_format", "verbose_json");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method:  "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body:    form,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`Whisper API ${res.status}: ${errText}`);
    }
    return (await res.json()) as WhisperVerboseResponse;
  }
}

// Deterministic fallback used when no API key is configured (dev mode).
const STUB_TRANSCRIPT = `
Bienvenidos a la reunión de planificación del Q2. Hoy revisaremos el roadmap de producto.
Ana propone priorizar el rediseño del onboarding para mejorar la activación de usuarios.
Carlos comenta que el equipo de backend necesita dos semanas para refactorizar el módulo de autenticación.
Se decide lanzar la función de análisis con IA en agosto. Luis se encargará de optimizar el funnel de conversión.
Existe un riesgo de capacidad: Carlos podría no estar disponible al cien por ciento durante el sprint tres.
Como próximo paso, agendaremos la retrospectiva del sprint dos para el próximo lunes a las diez.
Diana documentará todas las decisiones en Notion. Gracias a todos por su participación.
`.trim();

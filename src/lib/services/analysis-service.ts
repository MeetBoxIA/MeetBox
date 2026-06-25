// ─────────────────────────────────────────────────────────────────────────────
// MeetingAnalysisService — extracts structured insight from a transcript.
//
// Asks GPT-4o-mini to return a STRICT JSON object (summary, tasks, decisions,
// risks, mentions, next steps) which is then persisted as NORMALIZED rows by
// AnalysisRepo — not just blobbed as JSON. Without an API key it derives a
// best-effort heuristic analysis so the pipeline still completes in dev.
// ─────────────────────────────────────────────────────────────────────────────

import { AnalysisRepo } from "../repositories/pipeline-repo";
import { getSupabase } from "../supabase";
import type { Logger } from "../logger";
import type { AnalysisResult, Destination, Priority, Severity } from "../types/pipeline";

const SYSTEM_PROMPT = `Eres un analista experto de reuniones. Recibes la transcripción de una reunión
y devuelves EXCLUSIVAMENTE un objeto JSON válido (sin texto adicional, sin markdown) con esta forma:

{
  "headline": "resumen en una sola línea",
  "summary": "resumen ejecutivo de 2-4 frases",
  "next_steps": ["paso 1", "paso 2"],
  "tasks": [
    { "title": "...", "description": "...", "assignee": "nombre o null",
      "priority": "low|medium|high|critical", "due_hint": "texto o null",
      "destination": "jira|slack|notion|teams|meetbook|zoom" }
  ],
  "decisions": [ { "title": "...", "detail": "...", "decided_by": "nombre o null" } ],
  "risks": [ { "title": "...", "detail": "...", "severity": "low|medium|high|critical", "owner": "nombre o null" } ],
  "mentions": [ { "name": "Nombre Persona", "count": 2 } ],
  "reminders": [
    { "title": "máximo 10 palabras — cosa concreta que alguien no debe olvidar", "deadline_hint": "texto o null" }
  ]
}

Reglas generales:
- Para tareas técnicas usa destination "jira"; decisiones "notion"; riesgos "slack"; notas "meetbook"; si la tarea implica agendar, crear o programar una reunión usa destination "zoom".
- Extrae solo lo que realmente aparece en la transcripción. No inventes.
- Responde en el mismo idioma de la transcripción.

Reglas para "reminders" — DETECCIÓN POR PALABRAS CLAVE (muy importante):
Crea un reminder cuando en la transcripción aparezca CUALQUIERA de estas señales de lenguaje:
  • Frases literales: "recordemos que", "recuerden que", "no olvidar", "no olviden", "hay que recordar",
    "tener en cuenta", "ojo con", "aviso importante", "pendiente de", "queda pendiente",
    "acordarse de", "antes del [día/fecha]", "para el [día/fecha]", "avisad a", "avisar a",
    "recuérdame", "recuérdale", "agenda pendiente", "quedamos en", "lo apunto", "lo anoto"
  • Compromisos informales sin ticket: "yo me encargo de X", "te mando X mañana", "lo reviso esta semana"
  • Fechas con acción pequeña: cualquier frase con una fecha futura + una acción concreta pequeña
  • "Tareas fantasma": cosas que se dicen de paso y que si nadie las apunta se pierden

Ejemplos de reminders válidos:
  "Recordemos enviar el contrato antes del viernes" → reminder: "Enviar contrato antes del viernes"
  "Ojo que hay que avisar a marketing del cambio" → reminder: "Avisar a marketing del cambio"
  "No olvidéis la reunión del jueves a las 10" → reminder: "Reunión del jueves a las 10"
  "Agenda para la próxima semana revisar los KPIs" → reminder: "Revisar KPIs la próxima semana"
  "Quedamos en que Juan revisa el presupuesto" → reminder: "Juan revisa el presupuesto"`;


interface OpenAIChatResponse {
  choices?: { message?: { content?: string } }[];
  usage?:   { total_tokens?: number };
  error?:   { message?: string };
}

export class MeetingAnalysisService {
  constructor(private log: Logger) {}

  /** Analyze a transcript and persist normalized entities. Returns ids + result. */
  async analyze(input: {
    userId: string; recordingId: string; transcriptId: string; jobId: string; transcript: string;
  }): Promise<{ analysisId: string; result: AnalysisResult }> {
    let result: AnalysisResult;
    let tokensUsed: number | undefined;

    if (process.env.OPENAI_API_KEY) {
      const { parsed, tokens } = await this.callLLM(input.transcript);
      result     = parsed;
      tokensUsed = tokens;
    } else {
      this.log.warn("analysis: no OPENAI_API_KEY, using heuristic analysis");
      result = heuristicAnalysis(input.transcript);
    }

    const { analysisId, counts } = await AnalysisRepo.persist({
      userId: input.userId, recordingId: input.recordingId,
      transcriptId: input.transcriptId, jobId: input.jobId,
      result, tokensUsed,
    });

    // Persist AI-detected ghost-task reminders to the reminders table
    const rawReminders = (result as AnalysisResult & { reminders?: { title: string; deadline_hint?: string | null }[] }).reminders ?? [];
    if (rawReminders.length > 0) {
      const { data: userRow } = await getSupabase().from("users").select("email").eq("id", input.userId).single();
      const userEmail = userRow?.email as string | undefined;
      if (userEmail) {
        const rows = rawReminders
          .filter((r) => r.title?.trim())
          .map((r) => ({
            user_email: userEmail,
            title:      String(r.title).trim().slice(0, 200),
            source:     "ai" as const,
            session_id: null,
            deadline:   null,
            completed:  false,
          }));
        if (rows.length > 0) {
          const { error: rErr } = await getSupabase().from("reminders").insert(rows);
          if (rErr) this.log.warn("analysis: could not persist reminders", { error: rErr.message });
          else this.log.info("analysis: persisted ghost-task reminders", { count: rows.length });
        }
      }
    }

    this.log.info("analysis: persisted normalized entities", counts);
    return { analysisId, result };
  }

  private async callLLM(transcript: string): Promise<{ parsed: AnalysisResult; tokens?: number }> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: `Transcripción:\n\n${transcript}` },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
        max_tokens: 2000,
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as OpenAIChatResponse;
      throw new Error(`Analysis LLM ${res.status}: ${body.error?.message ?? res.statusText}`);
    }

    const data    = (await res.json()) as OpenAIChatResponse;
    const content = data.choices?.[0]?.message?.content ?? "{}";
    return { parsed: normalize(JSON.parse(content)), tokens: data.usage?.total_tokens };
  }
}

// ── Normalize/validate the LLM output into a safe AnalysisResult ──────────────
function normalize(raw: unknown): AnalysisResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  const priorities: Priority[]   = ["low", "medium", "high", "critical"];
  const severities:  Severity[]  = ["low", "medium", "high", "critical"];
  const dests: Destination[]     = ["jira", "slack", "notion", "teams", "meetcalendar", "meetbook", "zoom"];

  const arr = (v: unknown): Record<string, unknown>[] => Array.isArray(v) ? v as Record<string, unknown>[] : [];
  const str = (v: unknown, fb = ""): string => typeof v === "string" ? v : fb;
  const strOrNull = (v: unknown): string | null => typeof v === "string" && v.trim() ? v : null;

  return {
    headline:   str(r.headline, "Reunión procesada"),
    summary:    str(r.summary, ""),
    next_steps: arr(r.next_steps).map((s) => str(s)).filter(Boolean).length
                  ? (r.next_steps as unknown[]).map((s) => str(s)).filter(Boolean)
                  : (Array.isArray(r.next_steps) ? [] : []),
    tasks: arr(r.tasks).map((t) => ({
      title:       str(t.title, "Tarea"),
      description: str(t.description),
      assignee:    strOrNull(t.assignee),
      priority:    priorities.includes(t.priority as Priority) ? t.priority as Priority : "medium",
      due_hint:    strOrNull(t.due_hint),
      destination: dests.includes(t.destination as Destination) ? t.destination as Destination : "jira",
    })),
    decisions: arr(r.decisions).map((d) => ({
      title: str(d.title, "Decisión"), detail: str(d.detail), decided_by: strOrNull(d.decided_by),
    })),
    risks: arr(r.risks).map((rk) => ({
      title: str(rk.title, "Riesgo"), detail: str(rk.detail),
      severity: severities.includes(rk.severity as Severity) ? rk.severity as Severity : "medium",
      owner: strOrNull(rk.owner),
    })),
    mentions: arr(r.mentions).map((m) => ({
      name: str(m.name, "—"), count: typeof m.count === "number" ? m.count : 1,
    })).filter((m) => m.name !== "—"),
  };
}

// ── Heuristic fallback (no API key) ──────────────────────────────────────────
// Extracts capitalized names and keyword-driven entities so the dev pipeline
// produces something plausible without calling an LLM.
function heuristicAnalysis(transcript: string): AnalysisResult {
  const sentences = transcript.split(/[.!?]\s+/).map((s) => s.trim()).filter(Boolean);
  const names = [...new Set((transcript.match(/\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}\b/g) ?? [])
    .filter((n) => !["Bienvenidos", "Como", "Existe", "Gracias", "Hoy", "Notion", "Jira", "Slack"].includes(n)))];

  const tasks = sentences.filter((s) => /encargar|optimiz|refactor|prioriz|implementar|preparar/i.test(s))
    .slice(0, 5).map((s) => ({
      title: s.slice(0, 80), description: s, assignee: names[0] ?? null,
      priority: "medium" as Priority, due_hint: null, destination: "jira" as Destination,
    }));

  const decisions = sentences.filter((s) => /se decide|decidimos|acord|lanzar/i.test(s))
    .slice(0, 4).map((s) => ({ title: s.slice(0, 80), detail: s, decided_by: names[1] ?? null }));

  const risks = sentences.filter((s) => /riesgo|problema|bloque|no estar disponible/i.test(s))
    .slice(0, 3).map((s) => ({ title: s.slice(0, 80), detail: s, severity: "high" as Severity, owner: names[0] ?? null }));

  const nextSteps = sentences.filter((s) => /próximo paso|agendar|retrospectiva|siguiente/i.test(s)).slice(0, 4);

  // Reminder keyword detection — mirrors the LLM system prompt rules
  const REMINDER_RE = /recordemo[s]?|recuerden|recuérda[mn]e|no olvid[eéa]|no olvidéis|hay que recordar|tener en cuenta|ojo con|aviso\b|avisad? a|avisar a|pendiente de|queda pendiente|acordarse de|antes del|para el (lunes|martes|miércoles|jueves|viernes|sábado|domingo|próximo|siguiente)|agenda pendiente|quedamos en|lo apunto|lo anoto|me encargo de|te mando|lo reviso esta|lo reviso la próxima/i;
  const reminders = sentences
    .filter((s) => REMINDER_RE.test(s))
    .slice(0, 6)
    .map((s) => ({ title: s.slice(0, 80), deadline_hint: null as string | null }));

  return {
    headline:   sentences[0]?.slice(0, 90) ?? "Reunión procesada",
    summary:    sentences.slice(0, 3).join(". ") + ".",
    next_steps: nextSteps,
    tasks, decisions, risks,
    mentions:   names.slice(0, 6).map((n) => ({ name: n, count: 1 })),
    reminders,
  };
}

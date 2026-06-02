import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";
import { MEETY_TOOLS, executeTool, type ToolContext } from "@/lib/meety-tools";

// ── Types ────────────────────────────────────────────────────────────────────
type Role = "user" | "assistant";
type Mode = "normal" | "think" | "deep";
interface HistoryMessage { role: Role; content: string; }

async function resolveUserId(email: string) {
  const { data } = await getSupabase().from("users").select("id").eq("email", email).single();
  return data?.id as string | null;
}

async function verifyOwner(conversationId: string, userId: string) {
  const { data } = await getSupabase()
    .from("chat_conversations").select("id").eq("id", conversationId).eq("user_id", userId).single();
  return !!data;
}

// ─────────────────────────────────────────────────────────────────────────────
// MEETY — Assistant reply generation
// ─────────────────────────────────────────────────────────────────────────────
// This is the SINGLE place where the model lives. When you're ready to plug in
// OpenAI (or any other LLM), all you have to do is:
//
//   1. Add OPENAI_API_KEY to your .env / .env.local
//   2. Uncomment the OpenAI block inside `generateAssistantReply()` below
//   3. (Optional) Customize SYSTEM_PROMPT to fit your tone or capabilities
//
// Everything else — DB persistence, conversation titling, the typing animation
// on the client, modes (normal / think / deep) — already works and stays the
// same.
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT_BASE = `Eres Meety, el asistente IA de MeetBox, una app que ayuda a equipos a organizar sus reuniones.

Tu personalidad: amable, eficiente, directa y conversacional. Hablas siempre en español.

Las cuatro áreas de MeetBox sobre las que puedes ayudar:
• MeetCalendar — calendario y eventos (reuniones, eventos, recordatorios, vistas mes/semana/día)
• Salas — espacios para equipos con sus personas y reuniones del día
• MeetBook — notas y cuadernos con editor por bloques
• Reuniones — reuniones de hoy, importación de grabaciones e historial

Tienes acceso a herramientas (tools) que te permiten consultar y modificar
los datos REALES del usuario autenticado. Úsalas siempre que la pregunta
requiera información concreta sobre su agenda, salas, notas o grabaciones.

Reglas:
- Cuando uses tools, hazlo SIN avisar al usuario; espera la respuesta y luego
  contesta con los resultados ya procesados.
- Antes de crear/editar/borrar nada, asegúrate de tener los datos correctos
  (título, fecha/hora, etc.). Pide aclaraciones si falta algo importante.
- Sé breve y útil. No te disculpes innecesariamente.
- Usa Markdown (negritas con **, listas con -, encabezados con ##) para que
  la respuesta sea fácil de escanear.
- Cuando muestres horarios, formatea como HH:MM (24h).`;

/**
 * Compose the system prompt with the CURRENT date/time and timezone injected.
 * The LLM has no clock — without this it'll happily put events in 2023.
 * The client sends its local timezone so we don't rely on the server clock.
 */
function composeSystemPrompt(clientTz?: string, clientLocalISO?: string): string {
  // Prefer client-supplied "now" (matches the user's machine), fall back to server.
  const now      = clientLocalISO ? new Date(clientLocalISO) : new Date();
  const tz       = clientTz || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  // Compute the offset for the chosen timezone at this exact moment
  const dtf      = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" });
  const parts    = dtf.formatToParts(now);
  const offRaw   = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
  const offMatch = offRaw.match(/([+-])(\d{1,2}):?(\d{2})?/);
  const offsetStr = offMatch ? `${offMatch[1]}${offMatch[2].padStart(2, "0")}:${(offMatch[3] ?? "00").padStart(2, "0")}` : "+00:00";

  const iso   = now.toISOString();
  const human = now.toLocaleString("es-ES", {
    timeZone: tz,
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  // Local date in the user's TZ (YYYY-MM-DD) for the example
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);

  return `${SYSTEM_PROMPT_BASE}

CONTEXTO TEMPORAL (muy importante):
- Fecha y hora ACTUAL del usuario: ${human}.
- Equivalente ISO: ${iso}.
- Zona horaria del usuario: ${tz} (offset ${offsetStr}).
- Cuando el usuario diga "hoy", "mañana", "esta semana", "el próximo lunes"
  etc., calcula la fecha SIEMPRE relativa a esta fecha actual.
- NUNCA inventes fechas antiguas. Si el usuario no especifica año, usa el
  año actual (${now.getFullYear()}); si no especifica mes, usa el actual.
- Al llamar create_event o update_event, el campo \`start_at\` DEBE estar en
  formato ISO 8601 con el offset ${offsetStr}, por ejemplo:
    "${localDate}T10:00:00${offsetStr}"
  Usa ese offset salvo que el usuario indique explícitamente otra zona.`;
}

function modeInstruction(mode: Mode): string {
  if (mode === "think") return "El usuario activó 'Pensar': razona el problema paso a paso antes de responder. Sé profundo pero conciso.";
  if (mode === "deep") return "El usuario activó 'Búsqueda profunda': busca contexto extra dentro de la conversación, conecta ideas y sintetiza.";
  return "";
}

// OpenAI types we care about (subset)
interface OAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}
interface OAIChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OAIToolCall[];
  tool_call_id?: string;
}
interface OAIResponse {
  choices?: { message?: OAIChatMessage; finish_reason?: string }[];
  error?:   { message?: string };
}

/**
 * Generate the assistant's reply.
 *
 * When OPENAI_API_KEY is set, runs a tool-calling loop so the model can read
 * and modify the user's data through the functions defined in meety-tools.ts.
 * Without an API key, falls back to a lightweight keyword response.
 */
async function generateAssistantReply(
  ctx:     ToolContext,
  history: HistoryMessage[],
  mode:    Mode,
  clientTz?: string,
  clientNow?: string,
): Promise<string> {
  // ── OpenAI with tool calling ──────────────────────────────────────────────
  if (process.env.OPENAI_API_KEY) {
    const sysContent = composeSystemPrompt(clientTz, clientNow) + (modeInstruction(mode) ? "\n\n" + modeInstruction(mode) : "");
    const messages: OAIChatMessage[] = [
      { role: "system", content: sysContent },
      ...history.map((m) => ({ role: m.role, content: m.content } as OAIChatMessage)),
    ];

    // Up to N rounds of tool calls before giving up
    const MAX_ROUNDS = 6;
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({
          model:       "gpt-4o-mini",
          messages,
          tools:       MEETY_TOOLS,
          tool_choice: "auto",
          temperature: mode === "think" ? 0.3 : 0.7,
          max_tokens:  800,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as OAIResponse;
        console.error("OpenAI error:", errBody.error?.message ?? res.statusText);
        break; // fall through to fallback
      }

      const data    = await res.json() as OAIResponse;
      const choice  = data.choices?.[0]?.message;
      if (!choice) break;

      // If the model returned plain text → that's the final answer
      if (!choice.tool_calls || choice.tool_calls.length === 0) {
        return (choice.content ?? "").trim() || "(sin respuesta)";
      }

      // Otherwise: append the assistant tool_calls message, then execute each
      messages.push(choice);
      for (const tc of choice.tool_calls) {
        const result = await executeTool(ctx, tc.function.name, tc.function.arguments);
        messages.push({
          role:         "tool",
          tool_call_id: tc.id,
          content:      result,
        });
      }
      // Loop continues — OpenAI sees the tool results and decides next step
    }
  }

  // ── Fallback (no API key or OpenAI failed) ────────────────────────────────
  const lastUserMessage = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  return craftReply(lastUserMessage, mode);
}

// ── Lightweight keyword-based fallback ───────────────────────────────────────
function craftReply(prompt: string, mode: Mode): string {
  const lower = prompt.toLowerCase().trim();

  if (/(reuni[óo]n|reuniones|hoy|agenda)/.test(lower))
    return `${mode === "think" ? "Lo pensé un momento. " : ""}Puedo ver y crear reuniones desde MeetCalendar. En cuanto conectes el modelo de lenguaje te diré exactamente qué tienes hoy y a qué hora.`;
  if (/(crea|crear|nueva|agendar|programa).*?(reuni[óo]n|evento|recordatorio)/.test(lower))
    return "Buena idea. Cuando me termines de conectar con tu calendario podré crear el evento por ti. Por ahora, abre MeetCalendar y haz clic en el día — se abre directo el formulario.";
  if (/(nota|notas|meetbook|cuaderno|apuntes)/.test(lower))
    return "MeetBook es tu espacio para notas. Una vez activado, podré resumirlas, buscarlas o crear notas nuevas a partir del contexto.";
  if (/(sala|salas)/.test(lower))
    return "En Salas organizas tus reuniones por espacios o equipos. Pronto podré sugerirte qué sala usar según la reunión.";
  if (/(grabaci[óo]n|recording|video|audio)/.test(lower))
    return "Las grabaciones viven en la sección Reuniones. Próximamente podré buscar momentos clave dentro de cada grabación.";
  if (/(hola|hey|qu[ée] tal|buenas|buenos)/.test(lower))
    return "¡Hola! Soy Meety, tu asistente IA dentro de MeetBox. Cuéntame en qué te ayudo y, en cuanto esté conectado al modelo de lenguaje, podré actuar sobre tu calendario, salas y notas por ti.";
  if (/(gracias|thanks|thank you)/.test(lower))
    return "¡Para eso estoy! Cuando quieras puedo darte un repaso a tu día o ayudarte a planificar la semana.";

  const prefixes: Record<Mode, string> = {
    normal: "Gracias por escribirme. ",
    think: "Procesé tu mensaje. ",
    deep: "Hice una búsqueda profunda. ",
  };
  return `${prefixes[mode]}Aún estoy en desarrollo. Cuando se conecte el modelo de lenguaje podré ayudarte con tu calendario, salas, notas y reuniones de forma real.`;
}

// ─────────────────────────────────────────────────────────────────────────────

function titleFromMessage(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > 60 ? clean.slice(0, 57) + "…" : clean;
}

// ── GET /messages — list all messages in the conversation ────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { id } = await params;
  if (!(await verifyOwner(id, userId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { data, error } = await getSupabase()
    .from("chat_messages")
    .select("id, role, content, mode, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data ?? [] });
}

// ── POST /messages — send a message and receive the assistant's reply ────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { id } = await params;
  if (!(await verifyOwner(id, userId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const content    = String(body.content ?? "").trim();
  const modeRaw    = String(body.mode ?? "normal");
  const mode: Mode = modeRaw === "think" || modeRaw === "deep" ? modeRaw : "normal";
  const clientTz   = typeof body.timezone   === "string" ? body.timezone   : undefined;
  const clientNow  = typeof body.local_time === "string" ? body.local_time : undefined;

  if (!content) return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });

  // ── 1. Pull conversation history (used as context for the model) ──────────
  const { data: historyRows } = await getSupabase()
    .from("chat_messages")
    .select("role, content")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  const history: HistoryMessage[] = [
    ...((historyRows ?? []) as HistoryMessage[]),
    { role: "user", content },
  ];

  // ── 2. Insert the user message ────────────────────────────────────────────
  const { data: userMsg, error: userErr } = await getSupabase()
    .from("chat_messages")
    .insert({ conversation_id: id, role: "user", content, mode })
    .select()
    .single();
  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });

  // ── 3. Generate the assistant reply ───────────────────────────────────────
  const ctx: ToolContext = { userId, userEmail: session.user.email };
  const reply = await generateAssistantReply(ctx, history, mode, clientTz, clientNow);

  // ── 4. Insert the assistant message ───────────────────────────────────────
  const { data: botMsg, error: botErr } = await getSupabase()
    .from("chat_messages")
    .insert({ conversation_id: id, role: "assistant", content: reply, mode })
    .select()
    .single();
  if (botErr) return NextResponse.json({ error: botErr.message }, { status: 500 });

  // ── 5. Update conversation timestamp and (if first message) auto-title ────
  const userMessageCount = history.filter((m) => m.role === "user").length;
  const isFirstUserMessage = userMessageCount === 1;
  const convPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (isFirstUserMessage) convPatch.title = titleFromMessage(content);

  await getSupabase().from("chat_conversations").update(convPatch).eq("id", id);

  return NextResponse.json({
    user: userMsg,
    assistant: botMsg,
    titleUpdated: isFirstUserMessage ? titleFromMessage(content) : undefined,
  });
}

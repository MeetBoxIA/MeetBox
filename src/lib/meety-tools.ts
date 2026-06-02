// ─────────────────────────────────────────────────────────────────────────────
// MEETY — Tool definitions + executor
// ─────────────────────────────────────────────────────────────────────────────
// Tools the LLM can call to read or modify the authenticated user's data.
// Every tool scopes its queries to the user's id, so the model can never see
// or touch anyone else's information.
//
// To add a new tool:
//   1. Add its OpenAI schema to MEETY_TOOLS
//   2. Add a case in `executeTool` that handles it and returns a JSON string
// ─────────────────────────────────────────────────────────────────────────────

import { getSupabase } from "./supabase";

export interface ToolContext {
  userId:    string;
  userEmail: string;
}

// ── Tool schemas (OpenAI function-calling format) ──────────────────────────
export const MEETY_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "get_today_meetings",
      description:
        "Devuelve las reuniones, eventos y recordatorios del usuario para HOY, ordenados por hora. Incluye sala asociada si la hay. Úsalo cuando el usuario pregunte por su día.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_events_in_range",
      description:
        "Devuelve los eventos del usuario en un rango de fechas (inclusive). Útil para 'esta semana', 'mañana', 'el próximo mes'.",
      parameters: {
        type: "object",
        properties: {
          start: { type: "string", description: "Fecha de inicio en formato YYYY-MM-DD" },
          end:   { type: "string", description: "Fecha de fin en formato YYYY-MM-DD"   },
        },
        required: ["start", "end"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_event",
      description:
        "Crea un nuevo evento en el calendario del usuario. Confirma antes con el usuario si no estás seguro de los datos.",
      parameters: {
        type: "object",
        properties: {
          title:       { type: "string", description: "Título corto del evento" },
          type:        { type: "string", enum: ["meeting", "event", "reminder"], description: "Tipo: reunión, evento o recordatorio" },
          start_at:    { type: "string", description: "Inicio en ISO 8601 con timezone (e.g. 2026-06-03T10:00:00-05:00)" },
          end_at:      { type: "string", description: "Fin en ISO 8601 (opcional, por defecto +1 hora)" },
          all_day:     { type: "boolean", description: "Si es todo el día" },
          location:    { type: "string", description: "Ubicación o URL (opcional)" },
          description: { type: "string", description: "Descripción o agenda (opcional)" },
        },
        required: ["title", "start_at"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_event",
      description: "Actualiza campos de un evento existente del usuario.",
      parameters: {
        type: "object",
        properties: {
          id:          { type: "string", description: "ID del evento a editar" },
          title:       { type: "string" },
          start_at:    { type: "string" },
          end_at:      { type: "string" },
          location:    { type: "string" },
          description: { type: "string" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_event",
      description: "Elimina un evento del calendario. Pide confirmación al usuario antes de llamar.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID del evento a eliminar" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_rooms",
      description: "Lista todas las salas del usuario, con cuántas personas y reuniones de hoy tiene cada una.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_room_detail",
      description: "Devuelve el detalle de una sala: personas asignadas y reuniones de hoy.",
      parameters: {
        type: "object",
        properties: { id: { type: "string", description: "ID de la sala" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_notebooks",
      description: "Lista los cuadernos del usuario en MeetBook, con su número de notas.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_notes",
      description: "Lista las notas dentro de un cuaderno específico.",
      parameters: {
        type: "object",
        properties: { notebook_id: { type: "string", description: "ID del cuaderno" } },
        required: ["notebook_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_note",
      description: "Crea una nota en un cuaderno. Pide el cuaderno al usuario si no lo sabes.",
      parameters: {
        type: "object",
        properties: {
          notebook_id: { type: "string" },
          title:       { type: "string" },
          content:     { type: "string", description: "Contenido en texto plano o markdown" },
        },
        required: ["notebook_id", "title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_recent_recordings",
      description: "Lista las grabaciones más recientes del usuario.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "Número de grabaciones a devolver (por defecto 10)" },
        },
      },
    },
  },
];

// ── Executor ───────────────────────────────────────────────────────────────
type ToolArgs = Record<string, unknown>;

function ok(payload: unknown): string {
  return JSON.stringify({ ok: true, data: payload });
}
function err(message: string): string {
  return JSON.stringify({ ok: false, error: message });
}

function startOfDayISO(d = new Date()): string {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x.toISOString();
}
function endOfDayISO(d = new Date()): string {
  const x = new Date(d); x.setHours(23, 59, 59, 999); return x.toISOString();
}

export async function executeTool(ctx: ToolContext, name: string, raw: string): Promise<string> {
  let args: ToolArgs = {};
  try { args = raw ? JSON.parse(raw) : {}; }
  catch { return err("Argumentos JSON inválidos"); }

  const db = getSupabase();

  try {
    switch (name) {

      // ── Calendar reads ──────────────────────────────────────────────────
      case "get_today_meetings": {
        const { data, error } = await db
          .from("calendar_events")
          .select("id, title, type, start_at, end_at, all_day, location, description, room_id")
          .eq("user_id", ctx.userId)
          .gte("start_at", startOfDayISO())
          .lte("start_at", endOfDayISO())
          .order("start_at", { ascending: true });
        if (error) return err(error.message);

        // Enrich with room name when relevant
        const enriched = await Promise.all((data ?? []).map(async (ev) => {
          if (!ev.room_id) return { ...ev, room: null };
          const { data: room } = await db.from("rooms").select("name, emoji").eq("id", ev.room_id).single();
          return { ...ev, room: room ?? null };
        }));
        return ok({ count: enriched.length, events: enriched });
      }

      case "get_events_in_range": {
        const start = String(args.start);
        const end   = String(args.end);
        if (!start || !end) return err("start y end son requeridos");
        const { data, error } = await db
          .from("calendar_events")
          .select("id, title, type, start_at, end_at, all_day, location, description, room_id")
          .eq("user_id", ctx.userId)
          .gte("start_at", `${start}T00:00:00Z`)
          .lte("start_at", `${end}T23:59:59Z`)
          .order("start_at", { ascending: true })
          .limit(100);
        if (error) return err(error.message);
        return ok({ count: data?.length ?? 0, events: data });
      }

      // ── Calendar writes ─────────────────────────────────────────────────
      case "create_event": {
        const title    = String(args.title ?? "").trim();
        const start_at = String(args.start_at ?? "");
        if (!title || !start_at) return err("title y start_at son obligatorios");

        const type     = String(args.type ?? "meeting") as "meeting" | "event" | "reminder";
        const color    = { meeting: "#050040", event: "#059669", reminder: "#d97706" }[type];

        const { data, error } = await db
          .from("calendar_events")
          .insert({
            user_id:        ctx.userId,
            title,
            type,
            start_at,
            end_at:         args.end_at      ?? null,
            all_day:        args.all_day     ?? false,
            location:       args.location    ?? null,
            description:    args.description ?? null,
            color,
            notify_email:   false,
            notify_minutes: 15,
          })
          .select("id, title, start_at, end_at")
          .single();
        if (error) return err(error.message);
        return ok({ created: data });
      }

      case "update_event": {
        const id = String(args.id ?? "");
        if (!id) return err("id es obligatorio");
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        for (const k of ["title", "start_at", "end_at", "location", "description"]) {
          if (args[k] !== undefined) patch[k] = args[k];
        }
        const { data, error } = await db
          .from("calendar_events")
          .update(patch)
          .eq("id", id)
          .eq("user_id", ctx.userId)
          .select("id, title, start_at, end_at")
          .single();
        if (error) return err(error.message);
        return ok({ updated: data });
      }

      case "delete_event": {
        const id = String(args.id ?? "");
        if (!id) return err("id es obligatorio");
        const { error } = await db
          .from("calendar_events").delete().eq("id", id).eq("user_id", ctx.userId);
        if (error) return err(error.message);
        return ok({ deleted: id });
      }

      // ── Rooms ────────────────────────────────────────────────────────────
      case "list_rooms": {
        const { data: rooms, error } = await db
          .from("rooms")
          .select("id, name, description, emoji, color")
          .eq("user_id", ctx.userId)
          .order("created_at", { ascending: true });
        if (error) return err(error.message);

        const enriched = await Promise.all((rooms ?? []).map(async (r) => {
          const [{ count: members }, { count: today }] = await Promise.all([
            db.from("room_members").select("id", { count: "exact", head: true }).eq("room_id", r.id),
            db.from("calendar_events")
              .select("id", { count: "exact", head: true })
              .eq("room_id", r.id).eq("user_id", ctx.userId)
              .gte("start_at", startOfDayISO()).lte("start_at", endOfDayISO()),
          ]);
          return { ...r, members: members ?? 0, meetings_today: today ?? 0 };
        }));
        return ok({ count: enriched.length, rooms: enriched });
      }

      case "get_room_detail": {
        const id = String(args.id ?? "");
        if (!id) return err("id es obligatorio");

        const { data: room, error: roomErr } = await db
          .from("rooms").select("*").eq("id", id).eq("user_id", ctx.userId).single();
        if (roomErr || !room) return err("Sala no encontrada");

        const { data: members } = await db
          .from("room_members").select("id, name, email").eq("room_id", id);
        const { data: meetings } = await db
          .from("calendar_events")
          .select("id, title, start_at, end_at, location")
          .eq("room_id", id).eq("user_id", ctx.userId)
          .gte("start_at", startOfDayISO()).lte("start_at", endOfDayISO())
          .order("start_at", { ascending: true });

        return ok({ room, members: members ?? [], meetings_today: meetings ?? [] });
      }

      // ── MeetBook ─────────────────────────────────────────────────────────
      case "list_notebooks": {
        const { data, error } = await db
          .from("notebooks")
          .select("id, title, emoji")
          .eq("user_id", ctx.userId)
          .is("deleted_at", null)
          .order("created_at", { ascending: true });
        if (error) return err(error.message);

        const enriched = await Promise.all((data ?? []).map(async (nb) => {
          const { count } = await db
            .from("notes").select("id", { count: "exact", head: true })
            .eq("notebook_id", nb.id).is("deleted_at", null);
          return { ...nb, notes: count ?? 0 };
        }));
        return ok({ count: enriched.length, notebooks: enriched });
      }

      case "list_notes": {
        const notebookId = String(args.notebook_id ?? "");
        if (!notebookId) return err("notebook_id es obligatorio");
        const { data, error } = await db
          .from("notes")
          .select("id, title, emoji, is_pinned, updated_at")
          .eq("notebook_id", notebookId)
          .eq("user_id", ctx.userId)
          .is("deleted_at", null)
          .order("is_pinned", { ascending: false })
          .order("updated_at", { ascending: false })
          .limit(50);
        if (error) return err(error.message);
        return ok({ count: data?.length ?? 0, notes: data });
      }

      case "create_note": {
        const notebookId = String(args.notebook_id ?? "");
        const title      = String(args.title ?? "").trim() || "Sin título";
        const content    = String(args.content ?? "");
        if (!notebookId) return err("notebook_id es obligatorio");
        const { data, error } = await db
          .from("notes")
          .insert({
            user_id:     ctx.userId,
            notebook_id: notebookId,
            title,
            emoji:       "📄",
            content,
          })
          .select("id, title, notebook_id")
          .single();
        if (error) return err(error.message);
        return ok({ created: data });
      }

      // ── Recordings ───────────────────────────────────────────────────────
      case "list_recent_recordings": {
        const limit = Math.min(50, Number(args.limit ?? 10));
        const { data, error } = await db
          .from("meeting_recordings")
          .select("id, title, file_name, file_size, created_at, event_id")
          .eq("user_id", ctx.userId)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) return err(error.message);
        return ok({ count: data?.length ?? 0, recordings: data });
      }

      default:
        return err(`Tool desconocida: ${name}`);
    }
  } catch (e) {
    return err(e instanceof Error ? e.message : "Error desconocido");
  }
}

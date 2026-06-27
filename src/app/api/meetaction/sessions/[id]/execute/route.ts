/**
 * POST /api/meetaction/sessions/[id]/execute
 *
 * Triggers execution of all approved action items in a session.
 * Creates an execution record, then dispatches each item to its destination.
 * In production this would be a background job; here it runs synchronously
 * for simplicity but the client polls the execution status.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";
import { sendSlackMessage } from "@/lib/integrations/slack";
import { createZoomMeeting } from "@/lib/integrations/zoom";
import { JiraService } from "@/lib/services/jira-service";
import { NotionService, type NotionDatabase } from "@/lib/integrations/notion";

type Params = { params: Promise<{ id: string }> };

async function resolveUserId(email: string) {
  const { data } = await getSupabase().from("users").select("id").eq("email", email).single();
  return data?.id as string | null;
}

/** Format a MeetAction item as a readable Slack message (Slack mrkdwn). */
function slackText(item: Record<string, unknown>): string {
  const typeLabels: Record<string, string> = {
    task: "📋 Tarea", decision: "✅ Decisión", risk: "⚠️ Riesgo",
    next_step: "➡️ Próximo paso", event: "📅 Evento", note: "📝 Nota",
  };
  const lines = [
    `*${typeLabels[item.type as string] ?? "Acción"} desde MeetBox*`,
    `*${item.title}*`,
  ];
  if (item.description)   lines.push(String(item.description));
  if (item.assignee_name) lines.push(`👤 Responsable: ${item.assignee_name}`);
  if (item.priority)      lines.push(`Prioridad: ${item.priority}`);
  return lines.join("\n");
}

/** Notion's built-in "People" collection rejects all page creation via the API. */
function isSpecialCollection(title: string): boolean {
  return /^people$/i.test(title.trim());
}

/**
 * Pick the best database among ones already known to be usable (callers
 * filter out special collections first). Prefers a name that looks
 * MeetBox-related; otherwise falls back to the first one available.
 */
function pickDatabase(dbs: NotionDatabase[]): NotionDatabase {
  const looksLikeMeetBox = (title: string) => /meetbox|meetaction|tarea|task|acci[oó]n|action/i.test(title);
  return dbs.find((d) => looksLikeMeetBox(d.title)) ?? dbs[0];
}

// Dispatcher — routes each action item to its destination service
async function dispatchItem(
  userId: string,
  roomId: string | null,
  item: Record<string, unknown>,
  meetingName?: string | null,
): Promise<{ ok: boolean; external_id?: string; external_url?: string; error?: string }> {
  switch (item.destination) {
    case "slack": {
      const meta = (item.destination_meta ?? {}) as { channel?: string };
      const res = await sendSlackMessage(userId, slackText(item), meta.channel);
      if (!res.ok) return { ok: false, error: `Slack: ${res.error}` };
      return { ok: true, external_id: res.ts, external_url: res.permalink ?? "#" };
    }
    case "jira": {
      const creds = await JiraService.getCredentials(userId);
      if (!creds) return { ok: false, error: "Jira no conectado. Conecta tu cuenta desde Integraciones." };

      // Project comes from destination_meta (set when the user picks a project
      // in the UI) — item.project_key was never a real column and always fell
      // through to the first project the integration could see.
      const meta = (item.destination_meta ?? {}) as {
        project?: string; issue_type?: string; labels?: string[]; start_at?: string;
      };
      let projectKey = meta.project;
      if (!projectKey) {
        const projects = await JiraService.getProjects(userId);
        if (projects.length === 0) return { ok: false, error: "No se encontraron proyectos en Jira" };
        projectKey = projects[0].key;
      }

      const priorityMap: Record<string, string> = {
        low: "Low", medium: "Medium", high: "High", critical: "Highest",
      };
      const typeToJira: Record<string, string> = {
        task: "Task", next_step: "Task", risk: "Bug", decision: "Task", note: "Task", event: "Task",
      };

      // Best-effort: resolve the assignee's Atlassian account id by name/email.
      // getCreateMeta (inside createIssue) still gates whether "assignee" is
      // actually on the project's create screen before sending it.
      let assigneeId: string | undefined;
      const who = item.assignee_email || item.assignee_name;
      if (who) {
        const matches = await JiraService.findUser(userId, String(who));
        assigneeId = matches[0]?.accountId;
      }

      const dueDate = meta.start_at ? meta.start_at.slice(0, 10) : undefined;

      const created = await JiraService.createIssue(userId, {
        projectKey,
        summary:     String(item.title ?? "Tarea de MeetBox"),
        description: String(item.description ?? ""),
        issueType:   meta.issue_type ?? typeToJira[String(item.type)] ?? "Task",
        priority:    priorityMap[String(item.priority ?? "medium")] ?? "Medium",
        assigneeId,
        labels:      meta.labels?.length ? meta.labels : ["meetbox"],
        dueDate,
      });

      if (!created.ok) return { ok: false, error: created.error };
      return { ok: true, external_id: created.result.key, external_url: created.result.url };
    }
    case "zoom": {
      const result = await createZoomMeeting(item, meetingName);
      if (!result.ok) return { ok: false, error: result.error };
      // Also create a calendar event linked to the workspace so it appears in the Rooms timeline
      await createCalendarEvent(userId, roomId, item, result.joinUrl);
      return { ok: true, external_id: result.meetingId, external_url: result.joinUrl };
    }
    case "meetcalendar": {
      const calId = await createCalendarEvent(userId, roomId, item, null);
      return { ok: true, external_id: calId ?? `cal-${Date.now()}`, external_url: "/dashboard?section=meetcalendar" };
    }
    case "meetbook": {
      const noteId = await createMeetBookNote(userId, item);
      return { ok: true, external_id: noteId ?? `note-${Date.now()}`, external_url: "/dashboard?section=meetbook" };
    }
    case "notion": {
      const creds = await NotionService.getCredentials(userId);
      if (!creds) return { ok: false, error: "Notion no conectado. Conecta tu cuenta desde Integraciones." };

      // Resolve databaseId: prefer item.destination_meta, else pick first available database.
      const meta       = (item.destination_meta ?? {}) as { database_id?: string };
      let databaseId   = meta.database_id;

      if (!databaseId) {
        const dbs    = await NotionService.getDatabases(userId);
        const usable = dbs.filter((d) => !isSpecialCollection(d.title));

        if (usable.length > 0) {
          databaseId = pickDatabase(usable).id;
        } else {
          // Only "People" (or nothing) is shared — auto-provision a dedicated
          // database under any page the integration can see, if one exists.
          databaseId = (await NotionService.getOrCreateDefaultDatabase(userId)) ?? undefined;
          if (!databaseId) {
            return {
              ok: false,
              error: dbs.length > 0
                ? "Solo se encontró la colección especial 'People' en Notion, y no hay ninguna página accesible para crear una base de datos nueva. Comparte una base de datos normal o una página con la integración."
                : "No se encontraron bases de datos ni páginas en Notion. Comparte al menos una con la integración.",
            };
          }
        }
      }

      const page = await NotionService.createPage(userId, {
        databaseId,
        title:       String(item.title ?? "Tarea de MeetBox"),
        type:        item.type ? String(item.type) : undefined,
        priority:    item.priority ? String(item.priority) : undefined,
        status:      "Pendiente",
        assignee:    item.assignee_name ? String(item.assignee_name) : undefined,
        email:       item.assignee_email ? String(item.assignee_email) : undefined,
        description: item.description ? String(item.description) : undefined,
      });

      if (!page) return { ok: false, error: "Error al crear página en Notion" };
      return { ok: true, external_id: page.id, external_url: page.url };
    }
    default:
      return { ok: false, error: `Destino "${item.destination}" no soportado.` };
  }
}

/** Create a calendar event in the user's MeetCalendar starting now. */
async function createCalendarEvent(
  userId: string,
  roomId: string | null,
  item: Record<string, unknown>,
  joinUrl: string | null | undefined,
): Promise<string | null> {
  const db    = getSupabase();
  const start = new Date();
  const end   = new Date(start.getTime() + 60 * 60_000); // 1 hour

  const { data, error } = await db.from("calendar_events").insert({
    user_id:        userId,
    title:          String(item.title ?? "Reunión MeetBox"),
    description:    item.description ? String(item.description) : null,
    location:       joinUrl ?? null,
    type:           "meeting",
    start_at:       start.toISOString(),
    end_at:         end.toISOString(),
    all_day:        false,
    color:          "#050040",
    notify_email:   false,
    notify_minutes: 15,
    room_id:        roomId,
    google_event_id: null,
    recurrence_freq:  null,
    recurrence_days:  null,
    recurrence_until: null,
  }).select("id").single();

  if (error) {
    console.error("[MeetAction] createCalendarEvent failed:", error.message, error.details ?? "");
    return null;
  }
  return data?.id ?? null;
}

/** Find or create a "MeetAction" notebook, then insert a note. */
async function createMeetBookNote(
  userId: string,
  item: Record<string, unknown>,
): Promise<string | null> {
  const db = getSupabase();

  // Find existing "MeetAction" notebook or create one
  let notebookId: string | null = null;
  const { data: existing } = await db.from("notebooks")
    .select("id")
    .eq("user_id", userId)
    .eq("title", "MeetAction")
    .is("deleted_at", null)
    .maybeSingle();

  if (existing?.id) {
    notebookId = existing.id;
  } else {
    const { data: created } = await db.from("notebooks").insert({
      user_id: userId,
      title:   "MeetAction",
      emoji:   "⚡",
    }).select("id").single();
    notebookId = created?.id ?? null;
  }

  if (!notebookId) return null;

  const lines: string[] = [];
  if (item.description) lines.push(String(item.description));
  if (item.assignee_name) lines.push(`\nResponsable: ${item.assignee_name}`);
  if (item.priority) lines.push(`Prioridad: ${item.priority}`);

  const { data: note, error } = await db.from("notes").insert({
    user_id:     userId,
    notebook_id: notebookId,
    title:       String(item.title ?? "Nota MeetBox"),
    emoji:       "📋",
    content:     lines.join("\n") || "",
  }).select("id").single();

  if (error) {
    console.error("createMeetBookNote error:", error.message);
    return null;
  }
  return note?.id ?? null;
}

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const userId = await resolveUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { id } = await params;
  const db = getSupabase();

  // Verify ownership
  const { data: meetSession } = await db
    .from("meet_action_sessions").select("id, status, room_id, meeting_name")
    .eq("id", id).eq("user_id", userId).single();
  if (!meetSession) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  const s = meetSession as { room_id: string | null; meeting_name: string | null };
  const sessionRoomId = s.room_id ?? null;
  const sessionMeetingName = s.meeting_name ?? null;

  // Get all approved items
  const { data: items } = await db
    .from("meet_action_items")
    .select("*")
    .eq("session_id", id)
    .eq("status", "approved");

  if (!items?.length) return NextResponse.json({ error: "No hay ítems aprobados para ejecutar" }, { status: 400 });

  // Create execution record
  const destinations = [...new Set(items.map((i) => i.destination as string))];
  const assignees    = [...new Set(items.map((i) => i.assignee_name as string).filter(Boolean))];

  const { data: execution } = await db
    .from("meet_action_executions")
    .insert({
      session_id:       id,
      user_id:          userId,
      status:           "running",
      total_items:      items.length,
      approved_items:   items.length,
      destinations_used: destinations,
      assignees,
    })
    .select().single();

  if (!execution) return NextResponse.json({ error: "Error creando ejecución" }, { status: 500 });

  // Update session status
  await db.from("meet_action_sessions")
    .update({ status: "approved", approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);

  // Dispatch items (runs in background conceptually — in prod use a queue)
  let executedCount = 0;
  let failedCount   = 0;
  const errorLog: unknown[] = [];

  for (const item of items) {
    // Mark as executing
    await db.from("meet_action_items")
      .update({ status: "executing", updated_at: new Date().toISOString() })
      .eq("id", item.id);

    const result = await dispatchItem(userId, sessionRoomId, item as Record<string, unknown>, sessionMeetingName);

    if (result.ok) {
      executedCount++;
      await db.from("meet_action_items")
        .update({ status: "executed", external_id: result.external_id, external_url: result.external_url, executed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", item.id);
    } else {
      failedCount++;
      errorLog.push({ item_id: item.id, error: result.error, timestamp: new Date().toISOString() });
      await db.from("meet_action_items")
        .update({ status: "failed", error_message: result.error, updated_at: new Date().toISOString() })
        .eq("id", item.id);
    }

    // Log each item execution
    await db.from("meet_action_execution_log").insert({
      execution_id:  execution.id,
      item_id:       item.id,
      session_id:    id,
      user_id:       userId,
      destination:   item.destination,
      status:        result.ok ? "success" : "failed",
      title:         item.title,
      external_id:   result.external_id ?? null,
      external_url:  result.external_url ?? null,
      error_message: result.error ?? null,
    });
  }

  const finalStatus = failedCount === 0 ? "completed" : executedCount === 0 ? "failed" : "partial";

  // Update execution record
  await db.from("meet_action_executions")
    .update({ status: finalStatus, executed_items: executedCount, failed_items: failedCount, completed_at: new Date().toISOString(), error_log: errorLog })
    .eq("id", execution.id);

  // Update session final status
  await db.from("meet_action_sessions")
    .update({ status: failedCount === 0 ? "executed" : "partial", executed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ execution_id: execution.id, status: finalStatus, executed: executedCount, failed: failedCount });
}

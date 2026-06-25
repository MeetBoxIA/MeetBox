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
import { createZoomMeeting as createZoomMeetingOAuth } from "@/lib/integrations/zoom";
import { JiraService } from "@/lib/services/jira-service";

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

/** Get a Zoom access token using Server-to-Server OAuth (account_credentials grant). */
async function getZoomAccessToken(): Promise<string> {
  const accountId    = process.env.ZOOM_ACCOUNT_ID?.trim();
  const clientId     = process.env.ZOOM_CLIENT_ID?.trim();
  const clientSecret = process.env.ZOOM_CLIENT_SECRET?.trim();

  if (!accountId || !clientId || !clientSecret) {
    throw new Error("Zoom: faltan variables de entorno (ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET)");
  }

  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
    {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(`Zoom token error: ${err.message ?? res.statusText}`);
  }

  const data = await res.json() as { access_token: string };
  return data.access_token;
}

/** Resolve the Zoom account owner's userId from ZOOM_USER_EMAIL env var. */
function getZoomUserId(): string {
  const email = process.env.ZOOM_USER_EMAIL?.trim();
  if (!email) throw new Error("Zoom: falta variable de entorno ZOOM_USER_EMAIL (email del dueño de la cuenta Zoom)");
  return email;
}

/** Create a Zoom meeting using Server-to-Server OAuth (no per-user token required). */
async function createZoomMeeting(
  _userId: string,
  item: Record<string, unknown>,
): Promise<{ ok: boolean; meetingId?: string; joinUrl?: string; error?: string }> {
  let accessToken: string;
  try {
    accessToken = await getZoomAccessToken();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  let zoomUserId: string;
  try {
    zoomUserId = getZoomUserId();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const res = await fetch(`https://api.zoom.us/v2/users/${zoomUserId}/meetings`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic:    String(item.title ?? "Reunión de MeetBox"),
      type:     2,
      duration: 60,
      agenda:   String(item.description ?? ""),
      settings: { join_before_host: true, waiting_room: false },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string; code?: number };
    return { ok: false, error: `Zoom API ${res.status}: ${err.message ?? res.statusText}` };
  }

  const data = await res.json() as { id: number; join_url: string };
  return { ok: true, meetingId: String(data.id), joinUrl: data.join_url };
}

// Dispatcher — routes each action item to its destination service
async function dispatchItem(
  userId: string,
  item: Record<string, unknown>,
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

      let projectKey = item.project_key as string | undefined;
      if (!projectKey) {
        const projects = await JiraService.getProjects(userId);
        if (projects.length === 0) return { ok: false, error: "No se encontraron proyectos en Jira" };
        projectKey = projects[0].key;
      }

      const priorityMap: Record<string, string> = {
        low: "Low", medium: "Medium", high: "High", critical: "Highest",
      };

      const result = await JiraService.createIssue(userId, {
        projectKey,
        summary:     String(item.title ?? "Tarea de MeetBox"),
        description: String(item.description ?? ""),
        issueType:   "Task",
        priority:    priorityMap[String(item.priority ?? "medium")] ?? "Medium",
        labels:      ["meetbox"],
      });

      if (!result) return { ok: false, error: "Error al crear issue en Jira" };
      return { ok: true, external_id: result.key, external_url: result.url };
    }
    case "zoom": {
      const result = await createZoomMeeting(userId, item);
      if (!result.ok) return { ok: false, error: result.error };
      // Also create a calendar event so the meeting appears in MeetCalendar
      await createCalendarEvent(userId, item, result.joinUrl);
      return { ok: true, external_id: result.meetingId, external_url: result.joinUrl };
    }
    case "meetcalendar": {
      const calId = await createCalendarEvent(userId, item, null);
      return { ok: true, external_id: calId ?? `cal-${Date.now()}`, external_url: "/dashboard?section=meetcalendar" };
    }
    case "meetbook": {
      const noteId = await createMeetBookNote(userId, item);
      return { ok: true, external_id: noteId ?? `note-${Date.now()}`, external_url: "/dashboard?section=meetbook" };
    }
    default:
      return { ok: true, external_id: `stub-${Date.now()}`, external_url: "#" };
  }
}

/** Create a calendar event in the user's MeetCalendar starting now. */
async function createCalendarEvent(
  userId: string,
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
    room_id:        null,
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
    .from("meet_action_sessions").select("id, status")
    .eq("id", id).eq("user_id", userId).single();
  if (!meetSession) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });

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

    const result = await dispatchItem(userId, item as Record<string, unknown>);

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

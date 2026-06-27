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
import { JiraService } from "./services/jira-service";

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
        "Returns the user's meetings, events, and reminders for TODAY, ordered by time. Includes the associated room if any. Use when the user asks about their day.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_events_in_range",
      description:
        "Returns the user's events within a date range (inclusive). Useful for 'this week', 'tomorrow', 'next month'.",
      parameters: {
        type: "object",
        properties: {
          start: { type: "string", description: "Start date in YYYY-MM-DD format" },
          end:   { type: "string", description: "End date in YYYY-MM-DD format"   },
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
        "Creates a new event on the user's calendar. Confirm with the user if any data is uncertain.",
      parameters: {
        type: "object",
        properties: {
          title:       { type: "string", description: "Short event title" },
          type:        { type: "string", enum: ["meeting", "event", "reminder"], description: "Type: meeting, event, or reminder" },
          start_at:    { type: "string", description: "Start in ISO 8601 with timezone (e.g. 2026-06-03T10:00:00-05:00)" },
          end_at:      { type: "string", description: "End in ISO 8601 (optional, defaults to +1 hour)" },
          all_day:     { type: "boolean", description: "Whether it's an all-day event" },
          location:    { type: "string", description: "Location or URL (optional)" },
          description: { type: "string", description: "Description or agenda (optional)" },
        },
        required: ["title", "start_at"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_event",
      description: "Updates fields on an existing user event.",
      parameters: {
        type: "object",
        properties: {
          id:          { type: "string", description: "ID of the event to edit" },
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
      description: "Deletes a calendar event. Ask the user for confirmation before calling.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID of the event to delete" },
        },
        required: ["id"],
      },
    },
  },
  // ── Reminders / Recordatorios ─────────────────────────────────────────────
  {
    type: "function" as const,
    function: {
      name: "list_reminders",
      description: "Returns the user's reminders (recordatorios). Use when the user asks about pending tasks, things to remember, or their reminder list.",
      parameters: {
        type: "object",
        properties: {
          filter: { type: "string", enum: ["all", "pending", "done"], description: "Filter: all, pending (incomplete), or done (completed). Defaults to pending." },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_reminder",
      description: "Creates a new reminder (recordatorio) for the user. Use when the user says 'recuérdame', 'no olvidar', 'añade un recordatorio', or any request to remember something. Confirm the title before creating.",
      parameters: {
        type: "object",
        properties: {
          title:    { type: "string", description: "Short description of what the user must remember or do" },
          deadline: { type: "string", description: "Optional deadline in ISO 8601 format (e.g. 2026-06-20T10:00:00-05:00). Only set if the user mentions a specific date/time." },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "complete_reminder",
      description: "Marks a reminder as completed. Use when the user says they finished or no longer need a reminder.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID of the reminder to mark as complete" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_reminder",
      description: "Deletes a reminder permanently. Ask for confirmation before calling.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID of the reminder to delete" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_rooms",
      description: "Lists all of the user's rooms, with member count and today's meeting count for each.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_room_detail",
      description: "Returns details for a room: assigned members and today's meetings.",
      parameters: {
        type: "object",
        properties: { id: { type: "string", description: "Room ID" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_notebooks",
      description: "Lists the user's MeetBook notebooks with their note count.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_notes",
      description: "Lists notes inside a specific notebook.",
      parameters: {
        type: "object",
        properties: { notebook_id: { type: "string", description: "Notebook ID" } },
        required: ["notebook_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_note",
      description: "Creates a note in a notebook. Ask the user which notebook if unknown.",
      parameters: {
        type: "object",
        properties: {
          notebook_id: { type: "string" },
          title:       { type: "string" },
          content:     { type: "string", description: "Content in plain text or markdown" },
        },
        required: ["notebook_id", "title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_recent_recordings",
      description: "Lists the user's most recent recordings.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "Number of recordings to return (default 10)" },
        },
      },
    },
  },

  // ── Jira tools ──────────────────────────────────────────────────────────
  {
    type: "function" as const,
    function: {
      name: "jira_create_issue",
      description:
        "Creates a new issue (task, bug, story) in Jira. Requires the user to have connected their Jira account. Ask for the project key if unknown.",
      parameters: {
        type: "object",
        properties: {
          projectKey:  { type: "string", description: "Jira project key (e.g. 'PROJ', 'DEV')" },
          summary:     { type: "string", description: "Issue title / summary" },
          description: { type: "string", description: "Detailed description (optional)" },
          issueType:   { type: "string", enum: ["Task", "Bug", "Story", "Epic"], description: "Issue type (default: Task)" },
          priority:    { type: "string", enum: ["Highest", "High", "Medium", "Low", "Lowest"], description: "Priority level" },
        },
        required: ["projectKey", "summary"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "jira_search",
      description:
        "Searches Jira issues using JQL. Returns matching issues with key, summary, status, assignee. Use for queries like 'my open tasks' or 'bugs in project X'.",
      parameters: {
        type: "object",
        properties: {
          jql:        { type: "string", description: "JQL query string (e.g. 'project = DEV AND status = \"To Do\"')" },
          maxResults: { type: "integer", description: "Max results to return (default 10, max 50)" },
        },
        required: ["jql"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "jira_transition_issue",
      description:
        "Moves a Jira issue to a new status (e.g. 'In Progress', 'Done'). Use when the user says to move, complete, or start an issue.",
      parameters: {
        type: "object",
        properties: {
          issueKey:       { type: "string", description: "Issue key (e.g. 'PROJ-123')" },
          transitionName: { type: "string", description: "Target status name (e.g. 'Done', 'In Progress')" },
        },
        required: ["issueKey", "transitionName"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "jira_add_comment",
      description:
        "Adds a comment to an existing Jira issue. Use when the user wants to add notes or updates to a ticket.",
      parameters: {
        type: "object",
        properties: {
          issueKey: { type: "string", description: "Issue key (e.g. 'PROJ-123')" },
          comment:  { type: "string", description: "Comment text to add" },
        },
        required: ["issueKey", "comment"],
      },
    },
  },
];

// ── Executor ───────────────────────────────────────────────────────────────
type ToolArgs = Record<string, unknown>;

/** Wrap a successful result as a JSON string the model can parse. */
function ok(payload: unknown): string {
  return JSON.stringify({ ok: true, data: payload });
}
/** Wrap an error message as a JSON string the model can parse. */
function err(message: string): string {
  return JSON.stringify({ ok: false, error: message });
}

/** Return midnight (local server time) as an ISO string for today's date. */
function startOfDayISO(d = new Date()): string {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x.toISOString();
}
/** Return 23:59:59.999 (local server time) as an ISO string for today's date. */
function endOfDayISO(d = new Date()): string {
  const x = new Date(d); x.setHours(23, 59, 59, 999); return x.toISOString();
}

/**
 * Execute a tool call on behalf of the authenticated user.
 * All queries are scoped to `ctx.userId` to prevent cross-user data access.
 *
 * @param ctx  - Caller's userId and email (from the session).
 * @param name - Tool name matching one of the MEETY_TOOLS schemas.
 * @param raw  - Raw JSON string of tool arguments from the LLM.
 * @returns    JSON string with `{ ok, data }` or `{ ok: false, error }`.
 */
export async function executeTool(ctx: ToolContext, name: string, raw: string): Promise<string> {
  let args: ToolArgs = {};
  try { args = raw ? JSON.parse(raw) : {}; }
  catch { return err("Invalid JSON arguments"); }

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
        if (!start || !end) return err("start and end are required");
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
        if (!title || !start_at) return err("title and start_at are required");

        const type  = String(args.type ?? "meeting") as "meeting" | "event" | "reminder";
        // Deterministic color per event type keeps the calendar visually consistent
        const color = { meeting: "#050040", event: "#059669", reminder: "#d97706" }[type];

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
        if (!id) return err("id is required");
        // Build patch dynamically so only provided fields are updated
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        for (const k of ["title", "start_at", "end_at", "location", "description"]) {
          if (args[k] !== undefined) patch[k] = args[k];
        }
        const { data, error } = await db
          .from("calendar_events")
          .update(patch)
          .eq("id", id)
          .eq("user_id", ctx.userId) // ownership guard
          .select("id, title, start_at, end_at")
          .single();
        if (error) return err(error.message);
        return ok({ updated: data });
      }

      case "delete_event": {
        const id = String(args.id ?? "");
        if (!id) return err("id is required");
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

        // Run member count and today-meeting count in parallel per room
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
        if (!id) return err("id is required");

        const { data: room, error: roomErr } = await db
          .from("rooms").select("*").eq("id", id).eq("user_id", ctx.userId).single();
        if (roomErr || !room) return err("Room not found");

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
          .is("deleted_at", null) // soft-delete filter
          .order("created_at", { ascending: true });
        if (error) return err(error.message);

        // Attach live note count to each notebook
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
        if (!notebookId) return err("notebook_id is required");
        const { data, error } = await db
          .from("notes")
          .select("id, title, emoji, is_pinned, updated_at")
          .eq("notebook_id", notebookId)
          .eq("user_id", ctx.userId)
          .is("deleted_at", null)
          // Pinned notes float to the top, then sorted by most recently edited
          .order("is_pinned", { ascending: false })
          .order("updated_at", { ascending: false })
          .limit(50);
        if (error) return err(error.message);
        return ok({ count: data?.length ?? 0, notes: data });
      }

      case "create_note": {
        const notebookId = String(args.notebook_id ?? "");
        const title      = String(args.title ?? "").trim() || "Untitled";
        const content    = String(args.content ?? "");
        if (!notebookId) return err("notebook_id is required");
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
        // Cap at 50 to prevent accidental large payloads to the LLM
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

      // ── Jira ─────────────────────────────────────────────────────────────
      case "jira_create_issue": {
        const projectKey = String(args.projectKey ?? "").trim();
        const summary    = String(args.summary ?? "").trim();
        if (!projectKey || !summary) return err("projectKey and summary are required");

        const result = await JiraService.createIssue(ctx.userId, {
          projectKey,
          summary,
          description: args.description ? String(args.description) : undefined,
          issueType:   args.issueType  ? String(args.issueType)  : undefined,
          priority:    args.priority   ? String(args.priority)   : undefined,
        });
        if (!result.ok) return err(result.error);
        return ok({ created: { key: result.result.key, url: result.result.url, id: result.result.id } });
      }

      case "jira_search": {
        const jql = String(args.jql ?? "").trim();
        if (!jql) return err("jql query is required");
        const maxResults = Math.min(50, Number(args.maxResults ?? 10));
        const result = await JiraService.searchJql(ctx.userId, jql, maxResults);
        return ok({
          total: result.total,
          issues: result.issues.map((i) => ({
            key:      i.key,
            summary:  i.fields.summary,
            status:   i.fields.status?.name ?? "Unknown",
            assignee: i.fields.assignee?.displayName ?? null,
            priority: i.fields.priority?.name ?? null,
            type:     i.fields.issuetype?.name ?? null,
          })),
        });
      }

      case "jira_transition_issue": {
        const issueKey       = String(args.issueKey ?? "").trim();
        const transitionName = String(args.transitionName ?? "").trim();
        if (!issueKey || !transitionName) return err("issueKey and transitionName are required");
        const success = await JiraService.transitionIssue(ctx.userId, issueKey, transitionName);
        if (!success) return err(`Could not transition ${issueKey} to "${transitionName}". Check the issue key and available transitions.`);
        return ok({ transitioned: { issueKey, to: transitionName } });
      }

      case "jira_add_comment": {
        const issueKey = String(args.issueKey ?? "").trim();
        const comment  = String(args.comment ?? "").trim();
        if (!issueKey || !comment) return err("issueKey and comment are required");
        const success = await JiraService.addComment(ctx.userId, issueKey, comment);
        if (!success) return err(`Failed to add comment to ${issueKey}. Check that the issue exists.`);
        return ok({ commented: { issueKey } });
      }

      // ── Reminders ────────────────────────────────────────────────────────────
      case "list_reminders": {
        const filter = String(args.filter ?? "pending");
        let q = db.from("reminders").select("*").eq("user_email", ctx.userEmail);
        if (filter === "pending") q = q.eq("completed", false);
        if (filter === "done")    q = q.eq("completed", true);
        const { data, error } = await q.order("created_at", { ascending: false }).limit(30);
        if (error) return err(error.message);
        return ok({ count: (data ?? []).length, reminders: data ?? [] });
      }

      case "create_reminder": {
        const title = String(args.title ?? "").trim();
        if (!title) return err("title is required");
        const { data, error } = await db.from("reminders").insert({
          user_email: ctx.userEmail,
          title,
          source:   "ai",
          deadline: args.deadline ?? null,
          completed: false,
        }).select().single();
        if (error) return err(error.message);
        return ok({ created: data });
      }

      case "complete_reminder": {
        const id = String(args.id ?? "").trim();
        if (!id) return err("id is required");
        const { data, error } = await db.from("reminders")
          .update({ completed: true })
          .eq("id", id).eq("user_email", ctx.userEmail)
          .select().single();
        if (error) return err(error.message);
        return ok({ completed: data });
      }

      case "delete_reminder": {
        const id = String(args.id ?? "").trim();
        if (!id) return err("id is required");
        const { error } = await db.from("reminders")
          .delete().eq("id", id).eq("user_email", ctx.userEmail);
        if (error) return err(error.message);
        return ok({ deleted: id });
      }

      default:
        return err(`Unknown tool: ${name}`);
    }
  } catch (e) {
    return err(e instanceof Error ? e.message : "Unknown error");
  }
}

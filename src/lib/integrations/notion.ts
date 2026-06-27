/**
 * Notion integration — thin wrapper around the Notion REST API v1.
 *
 * Credentials are stored on the `users` row (notion_access_token,
 * notion_workspace_id, notion_workspace_name, notion_bot_id).
 * The integration uses a standard OAuth 2.0 public integration flow
 * (client_id / client_secret), identical in shape to the Jira integration.
 */

import { getSupabase } from "../supabase";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface NotionCredentials {
  access_token:    string;
  workspace_id:    string;
  workspace_name:  string | null;
  bot_id:          string;
}

export interface NotionDatabase {
  id:    string;
  title: string;
  url:   string;
}

export interface NotionPageResult {
  id:  string;
  url: string;
}

type NotionPropMap = Record<string, { type: string }>;

// ── Service ────────────────────────────────────────────────────────────────────

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function notionHeaders(token: string) {
  return {
    Authorization:   `Bearer ${token}`,
    "Content-Type":  "application/json",
    "Notion-Version": NOTION_VERSION,
  };
}

const PRIORITY_ES: Record<string, string> = { low: "Baja", medium: "Media", high: "Alta", critical: "Crítica" };
const TYPE_ES: Record<string, string> = {
  task: "Tarea", decision: "Decisión", risk: "Riesgo",
  next_step: "Próximo paso", event: "Evento", note: "Nota",
};

/** Locates a property by any of its accepted names and a compatible type. */
function findProp(schema: NotionPropMap, names: string[], types: string[]): string | null {
  const entry = Object.entries(schema).find(
    ([k, p]) => names.some((n) => n.toLowerCase() === k.toLowerCase()) && types.includes(p.type),
  );
  return entry?.[0] ?? null;
}

export class NotionService {
  /** Fetch credentials for a user, or null if not connected. */
  static async getCredentials(userId: string): Promise<NotionCredentials | null> {
    const { data } = await getSupabase()
      .from("users")
      .select("notion_access_token, notion_workspace_id, notion_workspace_name, notion_bot_id")
      .eq("id", userId)
      .single();

    if (!data?.notion_access_token || !data?.notion_workspace_id) return null;

    return {
      access_token:   data.notion_access_token   as string,
      workspace_id:   data.notion_workspace_id   as string,
      workspace_name: data.notion_workspace_name as string | null,
      bot_id:         data.notion_bot_id         as string,
    };
  }

  /**
   * Search for databases the integration has access to.
   * Returns the first 10 databases shared with the integration.
   */
  static async getDatabases(userId: string): Promise<NotionDatabase[]> {
    const creds = await NotionService.getCredentials(userId);
    if (!creds) return [];

    const res = await fetch(`${NOTION_API}/search`, {
      method: "POST",
      headers: notionHeaders(creds.access_token),
      body: JSON.stringify({
        filter:      { value: "database", property: "object" },
        sort:        { direction: "descending", timestamp: "last_edited_time" },
        page_size:   10,
      }),
    });

    if (!res.ok) return [];

    const data = await res.json() as { results: { id: string; title: { plain_text: string }[][]; url: string }[] };

    return (data.results ?? []).map((db) => ({
      id:    db.id,
      title: db.title?.flat().map((t) => t.plain_text).join("") || "Sin título",
      url:   db.url,
    }));
  }

  /** Find any page the integration can see, to host an auto-created database. */
  static async findAccessiblePageId(token: string): Promise<string | null> {
    const res = await fetch(`${NOTION_API}/search`, {
      method: "POST",
      headers: notionHeaders(token),
      body: JSON.stringify({ filter: { value: "page", property: "object" }, page_size: 5 }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { results: { id: string }[] };
    return data.results?.[0]?.id ?? null;
  }

  /**
   * Returns a usable database id for the user, creating one automatically if
   * they haven't shared a usable database with the integration — only when
   * they've shared at least one page the integration can create the new
   * database under. Reuses a previously created database while it's still
   * accessible; otherwise the database is re-created and the id refreshed.
   */
  static async getOrCreateDefaultDatabase(userId: string): Promise<string | null> {
    const creds = await NotionService.getCredentials(userId);
    if (!creds) return null;

    const db = getSupabase();
    const { data: row } = await db
      .from("users").select("notion_default_database_id").eq("id", userId).single();
    const existingId = row?.notion_default_database_id as string | null;

    if (existingId) {
      const check = await fetch(`${NOTION_API}/databases/${existingId}`, { headers: notionHeaders(creds.access_token) });
      if (check.ok) return existingId;
      // No longer accessible (unshared/deleted) — fall through and recreate.
    }

    const pageId = await NotionService.findAccessiblePageId(creds.access_token);
    if (!pageId) return null;

    const createRes = await fetch(`${NOTION_API}/databases`, {
      method: "POST",
      headers: notionHeaders(creds.access_token),
      body: JSON.stringify({
        parent: { type: "page_id", page_id: pageId },
        title:  [{ type: "text", text: { content: "MeetBox · Acciones" } }],
        properties: { Name: { title: {} } },
      }),
    });
    if (!createRes.ok) return null;

    const created = await createRes.json() as { id: string; properties: NotionPropMap };
    await NotionService.ensureSchema(creds.access_token, created.id, created.properties);
    await db.from("users").update({ notion_default_database_id: created.id }).eq("id", userId);

    return created.id;
  }

  /** Fetch the property schema of a database, or null if the lookup fails. */
  static async getSchema(token: string, databaseId: string): Promise<NotionPropMap | null> {
    const res = await fetch(`${NOTION_API}/databases/${databaseId}`, { headers: notionHeaders(token) });
    if (!res.ok) return null;
    const db = await res.json() as { properties: NotionPropMap };
    return db.properties;
  }

  /**
   * Find the title property within an already-fetched schema. Notion
   * databases can name their title column anything ("Name", "Task",
   * "Nombre", ...) — only one property has type "title", so we look it up
   * instead of assuming "Name". Falls back to "Name" if none is found.
   */
  static titleKeyOf(schema: NotionPropMap): string {
    return Object.entries(schema).find(([, p]) => p.type === "title")?.[0] ?? "Name";
  }

  /**
   * Ensures the database has MeetBox's standard columns (Estado, Prioridad,
   * Tipo, Responsable, Email, Descripción) so action items can be filtered
   * and sorted natively in Notion instead of living as plain body text.
   *
   * Only ADDS missing columns by name — it never deletes or modifies an
   * existing property, and if the user already has an equivalent column
   * (e.g. their own "Priority" select) it's reused instead of duplicated.
   *
   * Best-effort: if the integration lacks edit permission on the database,
   * the PATCH fails silently and the original schema is returned — the page
   * is still created with whatever properties already exist.
   */
  static async ensureSchema(token: string, databaseId: string, schema: NotionPropMap): Promise<NotionPropMap> {
    const has = (name: string) => Object.keys(schema).some((k) => k.toLowerCase() === name.toLowerCase());

    const toAdd: Record<string, unknown> = {};
    if (!has("Estado") && !has("Status"))
      toAdd["Estado"] = { select: { options: [
        { name: "Pendiente", color: "yellow" }, { name: "Ejecutado", color: "green" },
      ] } };
    if (!has("Prioridad") && !has("Priority"))
      toAdd["Prioridad"] = { select: { options: [
        { name: "Baja", color: "green" }, { name: "Media", color: "yellow" },
        { name: "Alta", color: "orange" }, { name: "Crítica", color: "red" },
      ] } };
    if (!has("Tipo") && !has("Type"))
      toAdd["Tipo"] = { select: { options: [
        { name: "Tarea", color: "blue" }, { name: "Decisión", color: "purple" },
        { name: "Riesgo", color: "red" }, { name: "Próximo paso", color: "blue" },
        { name: "Evento", color: "pink" }, { name: "Nota", color: "gray" },
      ] } };
    if (!has("Responsable") && !has("Assignee")) toAdd["Responsable"] = { rich_text: {} };
    if (!has("Email"))       toAdd["Email"]       = { email: {} };
    if (!has("Descripción") && !has("Description")) toAdd["Descripción"] = { rich_text: {} };

    if (Object.keys(toAdd).length === 0) return schema;

    const res = await fetch(`${NOTION_API}/databases/${databaseId}`, {
      method: "PATCH",
      headers: notionHeaders(token),
      body: JSON.stringify({ properties: toAdd }),
    });
    if (!res.ok) return schema;

    const updated = await res.json() as { properties: NotionPropMap };
    return updated.properties ?? schema;
  }

  /**
   * Maps MeetAction item fields onto whichever compatible columns exist in
   * the schema. Fields without a matching column are simply omitted — they
   * never block page creation.
   */
  static buildProperties(schema: NotionPropMap, opts: {
    title:        string;
    type?:        string;
    priority?:    string;
    status?:      string;
    assignee?:    string;
    email?:       string;
    description?: string;
  }): Record<string, unknown> {
    const props: Record<string, unknown> = {};

    props[NotionService.titleKeyOf(schema)] = { title: [{ type: "text", text: { content: opts.title } }] };

    const setSelect = (names: string[], value?: string) => {
      if (!value) return;
      const key = findProp(schema, names, ["select", "status"]);
      if (!key) return;
      props[key] = schema[key].type === "status"
        ? { status: { name: value } }
        : { select: { name: value } };
    };
    const setText = (names: string[], value?: string) => {
      if (!value) return;
      const key = findProp(schema, names, ["rich_text"]);
      if (key) props[key] = { rich_text: [{ type: "text", text: { content: value } }] };
    };

    setSelect(["Prioridad", "Priority"], opts.priority ? PRIORITY_ES[opts.priority] ?? opts.priority : undefined);
    setSelect(["Tipo", "Type"],          opts.type ? TYPE_ES[opts.type] ?? opts.type : undefined);
    setSelect(["Estado", "Status"],      opts.status);
    setText(["Responsable", "Assignee"], opts.assignee);
    setText(["Descripción", "Description"], opts.description);

    if (opts.email) {
      const key = findProp(schema, ["Email", "Correo"], ["email"]);
      if (key) props[key] = { email: opts.email };
    }

    return props;
  }

  /**
   * Create a page (task) in a Notion database.
   * Maps MeetAction item fields to Notion page properties.
   *
   * The page is created with ONLY its title property first; the description/
   * assignee/priority are added as children in a second, best-effort step —
   * if that second step fails, the page itself still exists and the action
   * is not reported as failed.
   *
   * Note: Notion's built-in "People" database (and similar special
   * collections every workspace ships with) rejects ALL page creation via
   * the public API, not just child blocks — that failure is detected below
   * and surfaced as an actionable error telling the user to share a regular
   * database instead.
   */
  static async createPage(
    userId: string,
    opts: {
      databaseId:   string;
      title:        string;
      type?:        string;
      priority?:    string;
      status?:      string;
      assignee?:    string;
      email?:       string;
      description?: string;
    },
  ): Promise<NotionPageResult | null> {
    const creds = await NotionService.getCredentials(userId);
    if (!creds) return null;

    let schema = await NotionService.getSchema(creds.access_token, opts.databaseId);
    if (!schema) throw new Error("No se pudo leer el esquema de la base de datos de Notion.");

    schema = await NotionService.ensureSchema(creds.access_token, opts.databaseId, schema);
    const properties = NotionService.buildProperties(schema, opts);

    const res = await fetch(`${NOTION_API}/pages`, {
      method: "POST",
      headers: notionHeaders(creds.access_token),
      body: JSON.stringify({
        parent: { database_id: opts.databaseId },
        properties,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string };
      const message = err.message ?? res.statusText;
      if (/cannot be parented to the .* collection record/i.test(message)) {
        throw new Error(
          "La base de datos de Notion compartida es una colección especial (p. ej. 'People') que no admite crear páginas. " +
          "Comparte una base de datos normal (de tareas, notas, etc.) con la integración desde Notion e inténtalo de nuevo.",
        );
      }
      throw new Error(`Notion API ${res.status}: ${message}`);
    }

    const page = await res.json() as { id: string; url: string };

    // Cuerpo legible: la descripción también como bloque — secundario, no fatal.
    if (opts.description) {
      try {
        await fetch(`${NOTION_API}/blocks/${page.id}/children`, {
          method: "PATCH",
          headers: notionHeaders(creds.access_token),
          body: JSON.stringify({
            children: [{
              object: "block",
              type:   "paragraph",
              paragraph: { rich_text: [{ type: "text", text: { content: opts.description } }] },
            }],
          }),
        });
      } catch {
        // The page already exists; the body block is secondary detail.
      }
    }

    return { id: page.id, url: page.url };
  }
}

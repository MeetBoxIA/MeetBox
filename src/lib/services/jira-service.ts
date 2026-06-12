// ─────────────────────────────────────────────────────────────────────────────
// JiraService — API wrapper for Jira Cloud REST API v3.
//
// All methods receive userId to fetch credentials from DB. Token refresh is
// automatic: if a call returns 401, the service refreshes via the stored
// refresh_token and retries once.
//
// Endpoints hit: https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/...
// ─────────────────────────────────────────────────────────────────────────────

import { getSupabase } from "../supabase";

// ── Types ──────────────────────────────────────────────────────────────────────

interface JiraCredentials {
  access_token:  string;
  refresh_token: string | null;
  cloud_id:      string;
  site_url:      string;
}

export interface JiraIssueInput {
  projectKey:   string;
  summary:      string;
  description?: string;
  issueType?:   string;   // "Task" | "Bug" | "Story" | "Epic" — defaults to "Task"
  priority?:    string;   // "Highest" | "High" | "Medium" | "Low" | "Lowest"
  assigneeId?:  string;   // Atlassian account ID
  labels?:      string[];
  epicKey?:     string;   // Parent epic issue key
}

export interface JiraIssueResult {
  id:   string;
  key:  string;
  self: string;
  url:  string;
}

export interface JiraSearchResult {
  total:  number;
  issues: {
    key:     string;
    fields:  {
      summary:  string;
      status:   { name: string };
      assignee: { displayName: string; accountId: string } | null;
      priority: { name: string } | null;
      issuetype: { name: string };
    };
  }[];
}

export interface JiraTransition {
  id:   string;
  name: string;
  to:   { name: string };
}

export interface JiraProject {
  id:   string;
  key:  string;
  name: string;
}

export interface JiraSprint {
  id:    number;
  name:  string;
  state: string;   // "active" | "closed" | "future"
}

// ── Service ────────────────────────────────────────────────────────────────────

export class JiraService {
  // ── Credentials ────────────────────────────────────────────────────────────

  /** Fetch Jira credentials for a user, or null if not connected. */
  static async getCredentials(userId: string): Promise<JiraCredentials | null> {
    const { data } = await getSupabase()
      .from("users")
      .select("jira_access_token, jira_refresh_token, jira_cloud_id, jira_site_url")
      .eq("id", userId)
      .single();

    if (!data?.jira_access_token || !data?.jira_cloud_id) return null;

    return {
      access_token:  data.jira_access_token  as string,
      refresh_token: data.jira_refresh_token as string | null,
      cloud_id:      data.jira_cloud_id      as string,
      site_url:      data.jira_site_url      as string,
    };
  }

  /** Refresh the access token using the stored refresh_token. Returns new creds or null. */
  static async refreshToken(userId: string): Promise<JiraCredentials | null> {
    const { data: user } = await getSupabase()
      .from("users")
      .select("jira_refresh_token, jira_cloud_id, jira_site_url")
      .eq("id", userId)
      .single();

    if (!user?.jira_refresh_token) return null;

    const res = await fetch("https://auth.atlassian.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type:    "refresh_token",
        client_id:     process.env.JIRA_CLIENT_ID!,
        client_secret: process.env.JIRA_CLIENT_SECRET!,
        refresh_token: user.jira_refresh_token,
      }),
    });

    if (!res.ok) {
      console.error("Jira token refresh failed:", await res.text());
      // Clear stale tokens
      await getSupabase()
        .from("users")
        .update({
          jira_access_token: null, jira_refresh_token: null,
          jira_token_expiry: null, jira_cloud_id: null, jira_site_url: null,
        })
        .eq("id", userId);
      return null;
    }

    const tokens = await res.json() as {
      access_token: string; refresh_token?: string; expires_in?: number;
    };

    await getSupabase()
      .from("users")
      .update({
        jira_access_token:  tokens.access_token,
        jira_refresh_token: tokens.refresh_token ?? user.jira_refresh_token,
        jira_token_expiry:  tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : null,
      })
      .eq("id", userId);

    return {
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token ?? user.jira_refresh_token,
      cloud_id:      user.jira_cloud_id  as string,
      site_url:      user.jira_site_url  as string,
    };
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  /**
   * Make an authenticated request to the Jira REST API.
   * Automatically retries once with a refreshed token on 401.
   */
  private static async request(
    userId: string,
    method: string,
    path:   string,
    body?:  unknown,
  ): Promise<{ ok: boolean; status: number; data: unknown }> {
    let creds = await this.getCredentials(userId);
    if (!creds) return { ok: false, status: 401, data: { error: "Jira no conectado" } };

    const doFetch = async (token: string) => {
      const url = `https://api.atlassian.com/ex/jira/${creds!.cloud_id}/rest/api/3${path}`;
      return fetch(url, {
        method,
        headers: {
          Authorization:  `Bearer ${token}`,
          Accept:         "application/json",
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    };

    let res = await doFetch(creds.access_token);

    // Auto-refresh on 401
    if (res.status === 401) {
      const refreshed = await this.refreshToken(userId);
      if (!refreshed) return { ok: false, status: 401, data: { error: "Token expirado, reconecta Jira" } };
      creds = refreshed;
      res = await doFetch(creds.access_token);
    }

    const data = res.headers.get("content-type")?.includes("application/json")
      ? await res.json()
      : await res.text();

    return { ok: res.ok, status: res.status, data };
  }

  /**
   * Make a request to the Jira Agile REST API (for sprints/boards).
   */
  private static async agileRequest(
    userId: string,
    method: string,
    path:   string,
    body?:  unknown,
  ): Promise<{ ok: boolean; status: number; data: unknown }> {
    let creds = await this.getCredentials(userId);
    if (!creds) return { ok: false, status: 401, data: { error: "Jira no conectado" } };

    const doFetch = async (token: string) => {
      const url = `https://api.atlassian.com/ex/jira/${creds!.cloud_id}/rest/agile/1.0${path}`;
      return fetch(url, {
        method,
        headers: {
          Authorization:  `Bearer ${token}`,
          Accept:         "application/json",
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    };

    let res = await doFetch(creds.access_token);

    if (res.status === 401) {
      const refreshed = await this.refreshToken(userId);
      if (!refreshed) return { ok: false, status: 401, data: { error: "Token expirado" } };
      creds = refreshed;
      res = await doFetch(creds.access_token);
    }

    const data = res.headers.get("content-type")?.includes("application/json")
      ? await res.json()
      : await res.text();

    return { ok: res.ok, status: res.status, data };
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** List all Jira projects the user can access. */
  static async getProjects(userId: string): Promise<JiraProject[]> {
    const { ok, data } = await this.request(userId, "GET", "/project/search?maxResults=50");
    if (!ok) return [];
    const d = data as { values?: JiraProject[] };
    return d.values ?? [];
  }

  /** Create a new issue in Jira. */
  static async createIssue(userId: string, input: JiraIssueInput): Promise<JiraIssueResult | null> {
    // Build ADF (Atlassian Document Format) description
    const descriptionAdf = input.description ? {
      type:    "doc",
      version: 1,
      content: [{
        type: "paragraph",
        content: [{ type: "text", text: input.description }],
      }],
    } : undefined;

    const fields: Record<string, unknown> = {
      project:   { key: input.projectKey },
      summary:   input.summary,
      issuetype: { name: input.issueType ?? "Task" },
    };

    if (descriptionAdf) fields.description = descriptionAdf;
    if (input.priority)   fields.priority   = { name: input.priority };
    if (input.assigneeId) fields.assignee   = { accountId: input.assigneeId };
    if (input.labels?.length) fields.labels = input.labels;
    if (input.epicKey)    fields.parent     = { key: input.epicKey };

    const { ok, data } = await this.request(userId, "POST", "/issue", { fields });

    if (!ok) {
      console.error("Jira createIssue failed:", data);
      return null;
    }

    const d = data as { id: string; key: string; self: string };
    const creds = await this.getCredentials(userId);
    return {
      id:   d.id,
      key:  d.key,
      self: d.self,
      url:  creds ? `${creds.site_url}/browse/${d.key}` : d.self,
    };
  }

  /** Update fields on an existing issue. */
  static async updateIssue(
    userId: string, issueKey: string, fields: Record<string, unknown>,
  ): Promise<boolean> {
    const { ok } = await this.request(userId, "PUT", `/issue/${issueKey}`, { fields });
    return ok;
  }

  /** Get available transitions for an issue. */
  static async getTransitions(userId: string, issueKey: string): Promise<JiraTransition[]> {
    const { ok, data } = await this.request(userId, "GET", `/issue/${issueKey}/transitions`);
    if (!ok) return [];
    return (data as { transitions: JiraTransition[] }).transitions ?? [];
  }

  /** Transition an issue to a new status by transition name (e.g. "Done", "In Progress"). */
  static async transitionIssue(userId: string, issueKey: string, transitionName: string): Promise<boolean> {
    const transitions = await this.getTransitions(userId, issueKey);
    const match = transitions.find(
      (t) => t.name.toLowerCase() === transitionName.toLowerCase()
        || t.to.name.toLowerCase() === transitionName.toLowerCase(),
    );
    if (!match) {
      console.error(`Jira transition "${transitionName}" not found for ${issueKey}. Available:`, transitions.map(t => t.name));
      return false;
    }

    const { ok } = await this.request(userId, "POST", `/issue/${issueKey}/transitions`, {
      transition: { id: match.id },
    });
    return ok;
  }

  /** Add a comment to an issue. */
  static async addComment(userId: string, issueKey: string, bodyText: string): Promise<boolean> {
    const adfBody = {
      type:    "doc",
      version: 1,
      content: [{
        type: "paragraph",
        content: [{ type: "text", text: bodyText }],
      }],
    };

    const { ok } = await this.request(userId, "POST", `/issue/${issueKey}/comment`, {
      body: adfBody,
    });
    return ok;
  }

  /** Assign an issue to a user by their Atlassian account ID. */
  static async assignIssue(userId: string, issueKey: string, accountId: string): Promise<boolean> {
    const { ok } = await this.request(userId, "PUT", `/issue/${issueKey}/assignee`, {
      accountId,
    });
    return ok;
  }

  /** Search issues using JQL. */
  static async searchJql(userId: string, jql: string, maxResults = 20): Promise<JiraSearchResult> {
    const { ok, data } = await this.request(
      userId, "POST", "/search",
      { jql, maxResults, fields: ["summary", "status", "assignee", "priority", "issuetype"] },
    );
    if (!ok) return { total: 0, issues: [] };
    const d = data as JiraSearchResult;
    return { total: d.total ?? 0, issues: d.issues ?? [] };
  }

  /** List sprints for a board (Agile API). */
  static async getSprints(userId: string, boardId: number): Promise<JiraSprint[]> {
    const { ok, data } = await this.agileRequest(userId, "GET", `/board/${boardId}/sprint?maxResults=20`);
    if (!ok) return [];
    return (data as { values?: JiraSprint[] }).values ?? [];
  }

  /** Search for a Jira user by display name or email. */
  static async findUser(userId: string, query: string): Promise<{ accountId: string; displayName: string }[]> {
    const { ok, data } = await this.request(userId, "GET", `/user/search?query=${encodeURIComponent(query)}&maxResults=5`);
    if (!ok) return [];
    return (data as { accountId: string; displayName: string }[]) ?? [];
  }
}

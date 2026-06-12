// ─────────────────────────────────────────────────────────────────────────────
// Slack integration — OAuth v2 connect/disconnect + message sending.
//
// Flow:
//   GET /api/integrations/slack/connect  → redirect to Slack authorize (signed state)
//   GET /api/integrations/slack/callback → exchange code, store encrypted token
//   Execution Center → sendSlackMessage() posts approved MeetAction items
//
// The bot token is stored AES-256-GCM-encrypted in meeting_integrations
// (credentials_enc) so a DB leak never exposes usable Slack tokens.
//
// Required env: SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, APP_BASE_URL (or AUTH_URL)
// Slack app Bot Token Scopes: chat:write, channels:read, chat:write.public
// ─────────────────────────────────────────────────────────────────────────────

import { createHmac, createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "crypto";
import { getSupabase } from "../supabase";

const SLACK_AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize";
const SLACK_TOKEN_URL     = "https://slack.com/api/oauth.v2.access";
const BOT_SCOPES          = "chat:write,channels:read,chat:write.public";
const DEFAULT_CHANNEL     = "#general";

export function slackConfigured(): boolean {
  return !!(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET);
}

/** Public base URL of the app — used to build the OAuth redirect_uri. */
export function appBaseUrl(): string {
  return (process.env.APP_BASE_URL ?? process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function slackRedirectUri(): string {
  return `${appBaseUrl()}/api/integrations/slack/callback`;
}

// ── Encryption at rest (AES-256-GCM keyed off AUTH_SECRET) ───────────────────
function encKey(): Buffer {
  return createHash("sha256").update(`slack:${process.env.AUTH_SECRET ?? "fallback"}`).digest();
}

function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  // iv:tag:ciphertext, base64url
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64url")).join(":");
}

function decrypt(stored: string): string | null {
  try {
    const [ivB, tagB, encB] = stored.split(":");
    const decipher = createDecipheriv("aes-256-gcm", encKey(), Buffer.from(ivB, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encB, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// ── CSRF state (HMAC-signed userId + expiry) ─────────────────────────────────
export function signState(userId: string): string {
  const exp = Date.now() + 10 * 60_000; // valid 10 minutes
  const payload = `${userId}.${exp}`;
  const sig = createHmac("sha256", encKey()).update(payload).digest("base64url");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifyState(state: string): string | null {
  try {
    const [userId, expStr, sig] = Buffer.from(state, "base64url").toString("utf8").split(".");
    if (Date.now() > Number(expStr)) return null;
    const expected = createHmac("sha256", encKey()).update(`${userId}.${expStr}`).digest("base64url");
    const a = Buffer.from(sig), b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return userId;
  } catch {
    return null;
  }
}

// ── OAuth ─────────────────────────────────────────────────────────────────────
export function buildAuthorizeUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id:    process.env.SLACK_CLIENT_ID!,
    scope:        BOT_SCOPES,
    redirect_uri: slackRedirectUri(),
    state:        signState(userId),
  });
  return `${SLACK_AUTHORIZE_URL}?${params}`;
}

interface SlackOAuthResponse {
  ok:           boolean;
  error?:       string;
  access_token?: string;          // bot token (xoxb-…)
  team?:        { id: string; name: string };
  bot_user_id?: string;
}

/** Exchange the authorization code for a bot token. */
export async function exchangeCode(code: string): Promise<SlackOAuthResponse> {
  const res = await fetch(SLACK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      code,
      redirect_uri:  slackRedirectUri(),
    }),
  });
  return (await res.json()) as SlackOAuthResponse;
}

// ── Persistence (meeting_integrations) ───────────────────────────────────────
export async function saveSlackConnection(userId: string, oauth: SlackOAuthResponse): Promise<void> {
  const db = getSupabase();
  await db.from("meeting_integrations").upsert(
    {
      user_id:         userId,
      provider:        "slack",
      is_enabled:      true,
      config:          { team_id: oauth.team?.id, team_name: oauth.team?.name, default_channel: DEFAULT_CHANNEL },
      credentials_enc: encrypt(oauth.access_token!),
      updated_at:      new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  );
}

export interface SlackConnection {
  token:           string;
  teamName:        string | null;
  defaultChannel:  string;
}

export async function getSlackConnection(userId: string): Promise<SlackConnection | null> {
  const { data } = await getSupabase()
    .from("meeting_integrations")
    .select("is_enabled, config, credentials_enc")
    .eq("user_id", userId).eq("provider", "slack")
    .maybeSingle();
  if (!data?.is_enabled || !data.credentials_enc) return null;
  const token = decrypt(data.credentials_enc);
  if (!token) return null;
  const cfg = (data.config ?? {}) as { team_name?: string; default_channel?: string };
  return { token, teamName: cfg.team_name ?? null, defaultChannel: cfg.default_channel ?? DEFAULT_CHANNEL };
}

export async function disconnectSlack(userId: string): Promise<void> {
  const conn = await getSlackConnection(userId);
  // Best-effort token revocation on Slack's side
  if (conn) {
    await fetch("https://slack.com/api/auth.revoke", {
      method: "POST",
      headers: { Authorization: `Bearer ${conn.token}` },
    }).catch(() => {});
  }
  await getSupabase().from("meeting_integrations")
    .delete().eq("user_id", userId).eq("provider", "slack");
}

// ── Messaging ─────────────────────────────────────────────────────────────────
interface PostMessageResult {
  ok: boolean;
  error?: string;
  channel?: string;
  ts?: string;
  permalink?: string;
}

/**
 * Post a message to the user's Slack. Used by the Execution Center for
 * MeetAction items with destination "slack".
 * @param channel overrides the connection's default channel (name or ID).
 */
export async function sendSlackMessage(
  userId: string,
  text: string,
  channel?: string,
): Promise<PostMessageResult> {
  const conn = await getSlackConnection(userId);
  if (!conn) return { ok: false, error: "Slack no está conectado" };

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { Authorization: `Bearer ${conn.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ channel: channel ?? conn.defaultChannel, text, unfurl_links: false }),
  });
  const data = (await res.json()) as { ok: boolean; error?: string; channel?: string; ts?: string };
  if (!data.ok) return { ok: false, error: data.error ?? "slack_error" };

  // Public archive permalink: https://slack.com/archives/<channel>/p<ts without dot>
  const permalink = data.channel && data.ts
    ? `https://slack.com/archives/${data.channel}/p${data.ts.replace(".", "")}`
    : undefined;
  return { ok: true, channel: data.channel, ts: data.ts, permalink };
}

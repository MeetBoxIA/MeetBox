// ─────────────────────────────────────────────────────────────────────────────
// Zoom integration — OAuth 2.0 per-user connect/disconnect + meeting creation.
//
// Flow:
//   GET /api/integrations/zoom/connect   → redirect to Zoom authorize (signed state)
//   GET /api/integrations/zoom/callback  → exchange code, store encrypted tokens
//   Execution Center → createZoomMeeting() creates meetings on behalf of the user
//
// Tokens are stored AES-256-GCM-encrypted in meeting_integrations (credentials_enc).
// Access tokens expire in 1 h; they are refreshed automatically before each use.
//
// Required env: ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET
// Zoom app scopes: meeting:write:meeting
// Redirect URI to register in Zoom Marketplace: <APP_BASE_URL>/api/integrations/zoom/callback
// ─────────────────────────────────────────────────────────────────────────────

import { createHmac, createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "crypto";
import { getSupabase } from "../supabase";

const ZOOM_AUTHORIZE_URL = "https://zoom.us/oauth/authorize";
const ZOOM_TOKEN_URL     = "https://zoom.us/oauth/token";

export function zoomConfigured(): boolean {
  return !!(process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET);
}

export function appBaseUrl(): string {
  return (process.env.APP_BASE_URL ?? process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function zoomRedirectUri(): string {
  return `${appBaseUrl()}/api/integrations/zoom/callback`;
}

// ── Encryption at rest (AES-256-GCM) ─────────────────────────────────────────
function encKey(): Buffer {
  return createHash("sha256").update(`zoom:${process.env.AUTH_SECRET ?? "fallback"}`).digest();
}

function encrypt(plain: string): string {
  const iv     = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encKey(), iv);
  const enc    = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
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

// ── CSRF state (HMAC-signed userId + expiry) ──────────────────────────────────
export function signState(userId: string): string {
  const exp     = Date.now() + 10 * 60_000;
  const payload = `${userId}.${exp}`;
  const sig     = createHmac("sha256", encKey()).update(payload).digest("base64url");
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
    response_type: "code",
    client_id:     process.env.ZOOM_CLIENT_ID!,
    redirect_uri:  zoomRedirectUri(),
    state:         signState(userId),
  });
  return `${ZOOM_AUTHORIZE_URL}?${params}`;
}

interface ZoomTokenResponse {
  access_token?:  string;
  token_type?:    string;
  refresh_token?: string;
  expires_in?:    number;
  scope?:         string;
  error?:         string;
  reason?:        string;
}

function basicAuth(): string {
  return "Basic " + Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString("base64");
}

export async function exchangeCode(code: string): Promise<ZoomTokenResponse> {
  const res = await fetch(
    `${ZOOM_TOKEN_URL}?grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(zoomRedirectUri())}`,
    {
      method:  "POST",
      headers: { "Authorization": basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    },
  );
  return (await res.json()) as ZoomTokenResponse;
}

async function refreshAccessToken(refreshToken: string): Promise<ZoomTokenResponse> {
  const res = await fetch(
    `${ZOOM_TOKEN_URL}?grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
    {
      method:  "POST",
      headers: { "Authorization": basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    },
  );
  return (await res.json()) as ZoomTokenResponse;
}

// ── Persistence ───────────────────────────────────────────────────────────────
interface ZoomCredentials {
  access_token:  string;
  refresh_token: string;
  expires_at:    string;
}

export async function saveZoomConnection(userId: string, token: ZoomTokenResponse): Promise<void> {
  const expiresAt = new Date(Date.now() + (token.expires_in ?? 3600) * 1000).toISOString();
  const credJson  = JSON.stringify({
    access_token:  token.access_token,
    refresh_token: token.refresh_token,
    expires_at:    expiresAt,
  } satisfies ZoomCredentials);

  await getSupabase().from("meeting_integrations").upsert(
    {
      user_id:         userId,
      provider:        "zoom",
      is_enabled:      true,
      config:          { scope: token.scope ?? "" },
      credentials_enc: encrypt(credJson),
      updated_at:      new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  );
}

export async function getZoomConnection(userId: string): Promise<{ accessToken: string } | null> {
  const { data } = await getSupabase()
    .from("meeting_integrations")
    .select("is_enabled, credentials_enc")
    .eq("user_id", userId).eq("provider", "zoom")
    .maybeSingle();

  if (!data?.is_enabled || !data.credentials_enc) return null;
  const raw = decrypt(data.credentials_enc);
  if (!raw) return null;

  const creds = JSON.parse(raw) as ZoomCredentials;

  // Auto-refresh if token expires within 5 minutes
  if (new Date(creds.expires_at).getTime() - Date.now() < 5 * 60_000) {
    try {
      const refreshed = await refreshAccessToken(creds.refresh_token);
      if (refreshed.access_token) {
        await saveZoomConnection(userId, refreshed);
        return { accessToken: refreshed.access_token };
      }
    } catch {
      // Fall through — try existing token
    }
  }

  return { accessToken: creds.access_token };
}

export async function disconnectZoom(userId: string): Promise<void> {
  const conn = await getZoomConnection(userId);
  if (conn) {
    await fetch(`https://zoom.us/oauth/revoke?token=${conn.accessToken}`, {
      method:  "POST",
      headers: { "Authorization": basicAuth() },
    }).catch(() => {});
  }
  await getSupabase().from("meeting_integrations")
    .delete().eq("user_id", userId).eq("provider", "zoom");
}

// ── Meeting creation ──────────────────────────────────────────────────────────
export async function createZoomMeeting(
  userId: string,
  item: Record<string, unknown>,
): Promise<{ ok: boolean; meetingId?: string; joinUrl?: string; error?: string }> {
  const conn = await getZoomConnection(userId);
  if (!conn) return { ok: false, error: "Zoom no está conectado. Conéctalo desde Integraciones." };

  const res = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method:  "POST",
    headers: { "Authorization": `Bearer ${conn.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      topic:    String(item.title    ?? "Reunión de MeetBox"),
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

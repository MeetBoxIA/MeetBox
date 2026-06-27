// ─────────────────────────────────────────────────────────────────────────────
// Zoom integration — Server-to-Server OAuth (account_credentials grant).
//
// MeetBox uses a single Zoom account configured at the infra level (env vars),
// not a per-user OAuth connection. This avoids requiring end users — or admins
// without access to the Zoom Marketplace app — to register redirect URIs or
// grant per-user consent. Every meeting is created under the same Zoom account
// (ZOOM_USER_EMAIL) regardless of which MeetBox user triggers it.
//
// Required env: ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_USER_EMAIL
// Zoom app type: Server-to-Server OAuth (no redirect URI / Marketplace listing needed)
// Zoom app scopes: meeting:write:meeting
// ─────────────────────────────────────────────────────────────────────────────

export function zoomConfigured(): boolean {
  return !!(
    process.env.ZOOM_ACCOUNT_ID?.trim() &&
    process.env.ZOOM_CLIENT_ID?.trim() &&
    process.env.ZOOM_CLIENT_SECRET?.trim() &&
    process.env.ZOOM_USER_EMAIL?.trim()
  );
}

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
export async function createZoomMeeting(
  item: Record<string, unknown>,
  meetingName?: string | null,
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

  const topic  = meetingName ?? String(item.title ?? "Reunión de MeetBox");
  const agenda = String(item.title ?? "") + (item.description ? `\n\n${item.description}` : "");

  const res = await fetch(`https://api.zoom.us/v2/users/${zoomUserId}/meetings`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic,
      type:     2,
      duration: 60,
      agenda,
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

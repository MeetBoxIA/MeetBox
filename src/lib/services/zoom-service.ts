import { createHash, createHmac } from "crypto";
import { getSupabase } from "@/lib/supabase";

interface ZoomToken {
  access_token: string;
  expires_at: number;
}

interface ZoomMeetingInput {
  topic: string;
  start_time: string;
  duration_minutes?: number;
  timezone?: string;
  agenda?: string;
  settings?: {
    host_video?: boolean;
    participant_video?: boolean;
    mute_upon_entry?: boolean;
    waiting_room?: boolean;
    auto_recording?: "local" | "cloud" | "none";
  };
}

interface ZoomMeetingResponse {
  id: number;
  uuid: string;
  topic: string;
  join_url: string;
  start_url: string;
  start_time: string;
  duration: number;
  timezone: string;
  settings: Record<string, unknown>;
}

interface ZoomRecordingFile {
  id: string;
  meeting_id: string;
  recording_start: string;
  recording_end: string;
  file_type: string;
  file_extension: string;
  file_size: number;
  download_url: string;
  status: string;
  recording_type: string;
}

let _cachedToken: ZoomToken | null = null;

function getConfig() {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  if (!accountId || !clientId || !clientSecret) {
    throw new Error("Missing Zoom credentials in .env.local (ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET)");
  }
  return { accountId, clientId, clientSecret };
}

async function getAccessToken(): Promise<string> {
  if (_cachedToken && Date.now() < _cachedToken.expires_at) {
    return _cachedToken.access_token;
  }

  const { accountId, clientId, clientSecret } = getConfig();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoom OAuth failed (${res.status}): ${text}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  _cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000 - 60_000,
  };
  return _cachedToken.access_token;
}

const BASE = "https://api.zoom.us/v2";

async function zoomFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    },
  });
}

export class ZoomService {

  static async createMeeting(input: ZoomMeetingInput): Promise<ZoomMeetingResponse> {
    const duration = input.duration_minutes ?? 60;
    const res = await zoomFetch("/users/me/meetings", {
      method: "POST",
      body: JSON.stringify({
        topic: input.topic,
        type: 2,
        start_time: input.start_time,
        duration,
        timezone: input.timezone ?? "C",
        agenda: input.agenda ?? "",
        settings: {
          host_video: true,
          participant_video: true,
          mute_upon_entry: true,
          waiting_room: true,
          auto_recording: input.settings?.auto_recording ?? "cloud",
          ...input.settings,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Zoom createMeeting failed (${res.status}): ${text}`);
    }

    return res.json() as Promise<ZoomMeetingResponse>;
  }

  static async updateMeeting(meetingId: number, input: Partial<ZoomMeetingInput>): Promise<void> {
    const body: Record<string, unknown> = {};
    if (input.topic !== undefined) body.topic = input.topic;
    if (input.start_time !== undefined) body.start_time = input.start_time;
    if (input.duration_minutes !== undefined) body.duration = input.duration_minutes;
    if (input.timezone !== undefined) body.timezone = input.timezone;
    if (input.agenda !== undefined) body.agenda = input.agenda;
    if (input.settings !== undefined) body.settings = input.settings;

    if (Object.keys(body).length === 0) return;

    const res = await zoomFetch(`/meetings/${meetingId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });

    if (!res.ok && res.status !== 204) {
      const text = await res.text();
      throw new Error(`Zoom updateMeeting failed (${res.status}): ${text}`);
    }
  }

  static async deleteMeeting(meetingId: number): Promise<void> {
    const res = await zoomFetch(`/meetings/${meetingId}`, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      const text = await res.text();
      throw new Error(`Zoom deleteMeeting failed (${res.status}): ${text}`);
    }
  }

  static async getRecordings(meetingId: number): Promise<{
    id: number;
    uuid: string;
    topic: string;
    start_time: string;
    duration: number;
    recording_files: ZoomRecordingFile[];
    share_url: string;
  }> {
    const res = await zoomFetch(`/meetings/${meetingId}/recordings`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Zoom getRecordings failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  static async downloadRecording(downloadUrl: string): Promise<ArrayBuffer> {
    const token = await getAccessToken();
    const res = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`Zoom downloadRecording failed (${res.status})`);
    }
    return res.arrayBuffer();
  }

  static verifyWebhook(body: string, signature: string): boolean {
    const secret = process.env.ZOOM_WEBHOOK_SECRET;
    if (!secret) return false;
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    return expected === signature;
  }

  static verifyWebhookChallenge(plainToken: string): string {
    const secret = process.env.ZOOM_WEBHOOK_SECRET ?? "";
    const hash = createHmac("sha256", secret).update(plainToken).digest("hex");
    const encryptedToken = createHash("sha256").update(hash).digest("hex");
    return encryptedToken;
  }

  static async processRecordingCompleted(zoomMeetingId: number): Promise<void> {
    const supabase = getSupabase();

    const { data: event } = await supabase
      .from("calendar_events")
      .select("id, user_id, title")
      .eq("zoom_meeting_id", String(zoomMeetingId))
      .single();

    if (!event) {
      console.warn(`[Zoom] No calendar event found for meeting ${zoomMeetingId}`);
      return;
    }

    await supabase
      .from("calendar_events")
      .update({ zoom_status: "recording_ready", updated_at: new Date().toISOString() })
      .eq("id", event.id);

    try {
      const recording = await ZoomService.getRecordings(zoomMeetingId);
      const videoFile = recording.recording_files.find(
        (f) => f.file_type === "MP4" && f.status === "completed",
      );

      if (!videoFile) {
        console.warn(`[Zoom] No completed MP4 recording found for meeting ${zoomMeetingId}`);
        return;
      }

      await supabase
        .from("calendar_events")
        .update({ zoom_status: "processing", updated_at: new Date().toISOString() })
        .eq("id", event.id);

      const buffer = await ZoomService.downloadRecording(videoFile.download_url);

      const fileName = `zoom_${zoomMeetingId}_${videoFile.id}.${videoFile.file_extension.toLowerCase()}`;
      const storagePath = `${event.user_id}/zoom/${zoomMeetingId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("recordings")
        .upload(storagePath, Buffer.from(buffer), {
          contentType: `video/${videoFile.file_extension.toLowerCase()}`,
          upsert: true,
        });

      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

      const { data: recordingRow, error: recError } = await supabase
        .from("meeting_recordings")
        .insert({
          user_id: event.user_id,
          event_id: event.id,
          title: `Zoom: ${recording.topic}`,
          file_name: fileName,
          file_size: videoFile.file_size,
          mime_type: `video/${videoFile.file_extension.toLowerCase()}`,
          storage_path: storagePath,
          status: "ready",
          source: "zoom",
          duration_seconds: recording.duration * 60,
        })
        .select()
        .single();

      if (recError) throw new Error(`Recording insert failed: ${recError.message}`);

      await supabase
        .from("calendar_events")
        .update({ zoom_status: "processed", updated_at: new Date().toISOString() })
        .eq("id", event.id);

      console.log(`[Zoom] Recording processed for meeting ${zoomMeetingId}, recordingId=${recordingRow.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Zoom] Processing failed for meeting ${zoomMeetingId}: ${message}`);
      await supabase
        .from("calendar_events")
        .update({ zoom_status: "failed", updated_at: new Date().toISOString() })
        .eq("id", event.id);
    }
  }
}

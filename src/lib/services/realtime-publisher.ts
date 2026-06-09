// ─────────────────────────────────────────────────────────────────────────────
// RealtimePublisher — pushes pipeline events to the web client in real time.
//
// Two transports work together:
//   1. Postgres changes — meeting_processing_jobs and meeting_events are in the
//      `supabase_realtime` publication, so any UPDATE is delivered automatically
//      to clients subscribed to those tables (filtered by user_id).
//   2. Broadcast — for lightweight, explicit events we also send on a per-user
//      channel `meetaction:<userId>` so the UI can react without a table read.
//
// The web client subscribes with:
//   supabase.channel(`meetaction:${userId}`).on('broadcast', { event: '*' }, …)
// ─────────────────────────────────────────────────────────────────────────────

import { getSupabase } from "../supabase";
import type { MeetingEventType } from "../types/pipeline";

export class RealtimePublisher {
  /** Send a broadcast event on the user's MeetAction channel. */
  static async publish(userId: string, event: MeetingEventType, payload: Record<string, unknown>): Promise<void> {
    try {
      const channel = getSupabase().channel(`meetaction:${userId}`, { config: { broadcast: { ack: false } } });
      // Subscribing is required before send on a server-side ephemeral channel.
      await new Promise<void>((resolve) => {
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") resolve();
        });
        // Don't hang forever if Realtime is unavailable.
        setTimeout(resolve, 1500);
      });
      await channel.send({ type: "broadcast", event, payload });
      await getSupabase().removeChannel(channel);
    } catch {
      // Realtime is a best-effort enhancement; the DB row update is the source of truth.
    }
  }
}

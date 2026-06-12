import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { ZoomService } from "@/lib/services/zoom-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const event = body.event as string;
    const payload = body.payload;

    // ── URL validation (Zoom sends this when configuring the webhook) ──
    if (event === "endpoint.url_validation") {
      const plainToken = payload?.plainToken as string;
      if (!plainToken) {
        return NextResponse.json({ error: "Missing plainToken" }, { status: 400 });
      }
      const encryptedToken = ZoomService.verifyWebhookChallenge(plainToken);
      return NextResponse.json({ plainToken, encryptedToken });
    }

    // ── Persist incoming event for audit trail ──
    const zoomMeetingId = payload?.object?.id ? String(payload.object.id) : null;

    const { error: insertError } = await getSupabase()
      .from("zoom_webhook_events")
      .insert({
        event_type: event,
        zoom_meeting_id: zoomMeetingId,
        payload: body,
        status: "received",
      });

    if (insertError) {
      console.error("[Zoom Webhook] Failed to persist event:", insertError.message);
    }

    // ── Handle recording.completed ──
    if (event === "recording.completed" && zoomMeetingId) {
      await getSupabase()
        .from("zoom_webhook_events")
        .update({ status: "processing" })
        .eq("zoom_meeting_id", zoomMeetingId)
        .eq("event_type", event);

      ZoomService.processRecordingCompleted(Number(zoomMeetingId))
        .then(() => {
          console.log(`[Zoom Webhook] Recording processed for meeting ${zoomMeetingId}`);
        })
        .catch((err) => {
          console.error(`[Zoom Webhook] Error processing recording ${zoomMeetingId}:`, err);
        });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Zoom Webhook] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

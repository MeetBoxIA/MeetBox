/**
 * GET /api/meetaction/sessions/[id]/stream
 *
 * Server-Sent Events (SSE) endpoint that streams live processing updates for a
 * session's job. This is the WebSocket-free realtime path: the web client opens
 * an EventSource and receives `meeting.*` events as the pipeline advances.
 *
 * (Supabase Realtime is the primary transport — see RealtimePublisher — this SSE
 *  stream is a robust fallback that also works behind restrictive proxies.)
 *
 * Auth: web session.
 */
import { NextRequest } from "next/server";
import { auth } from "@/../auth";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function resolveUserId(email: string) {
  const { data } = await getSupabase().from("users").select("id").eq("email", email).single();
  return data?.id as string | null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return new Response("Unauthorized", { status: 401 });
  const userId = await resolveUserId(session.user.email);
  if (!userId) return new Response("Not found", { status: 404 });

  const { id } = await params;
  const db = getSupabase();

  // Verify ownership once before streaming.
  const { data: meetSession } = await db
    .from("meet_action_sessions").select("id, job_id, correlation_id")
    .eq("id", id).eq("user_id", userId).maybeSingle();
  if (!meetSession) return new Response("Not found", { status: 404 });

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send("connected", { sessionId: id });

      // Track the last event we've already forwarded to avoid duplicates.
      let lastSeen = new Date(0).toISOString();
      const correlationId = meetSession.correlation_id;

      // Poll meeting_events for this correlation id and forward new ones.
      // Terminates when a terminal event (completed/failed) is observed or
      // after a hard timeout to avoid hanging connections.
      const deadline = Date.now() + 5 * 60_000; // 5 min max

      const poll = async () => {
        if (closed) return;
        try {
          let q = db.from("meeting_events")
            .select("event_type, message, payload, level, created_at")
            .eq("user_id", userId)
            .gt("created_at", lastSeen)
            .order("created_at", { ascending: true });
          if (correlationId) q = q.eq("correlation_id", correlationId);

          const { data: events } = await q;
          for (const ev of events ?? []) {
            send(ev.event_type, { message: ev.message, payload: ev.payload, level: ev.level, at: ev.created_at });
            lastSeen = ev.created_at as string;
            if (ev.event_type === "meeting.completed" || ev.event_type === "meeting.failed") {
              send("done", { final: ev.event_type });
              cleanup();
              return;
            }
          }
        } catch {
          // transient — keep polling
        }

        if (Date.now() > deadline) { send("timeout", {}); cleanup(); return; }
        if (!closed) setTimeout(poll, 1500);
      };

      // Heartbeat keeps intermediaries from closing an idle connection.
      const heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 15_000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        try { controller.close(); } catch { /* already closed */ }
      };

      poll();
    },
    cancel() { closed = true; },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection":    "keep-alive",
    },
  });
}

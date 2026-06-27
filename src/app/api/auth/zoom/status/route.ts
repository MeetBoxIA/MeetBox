import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { zoomConfigured } from "@/lib/integrations/zoom";

/**
 * GET /api/auth/zoom/status
 * Zoom is configured account-wide via env vars (Server-to-Server OAuth),
 * not per-user — so "connected" just reflects whether the server has the
 * required credentials, the same for every authenticated user.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ connected: false }, { status: 401 });
  }

  return NextResponse.json({
    connected: zoomConfigured(),
    zoom_email: zoomConfigured() ? process.env.ZOOM_USER_EMAIL : null,
  });
}

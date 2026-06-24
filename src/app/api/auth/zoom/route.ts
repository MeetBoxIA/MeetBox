import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";

/**
 * GET /api/auth/zoom
 * Inicia el flujo OAuth 2.0 de Zoom redirigiendo al endpoint de autorización.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL("/auth", req.url));
  }

  // Usar AUTH_URL del entorno para garantizar que coincide exactamente
  // con la redirect URI registrada en Zoom Marketplace
  const base = (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const callbackUri = `${base}/api/auth/zoom/callback`;

  const clientId = process.env.ZOOM_CLIENT_ID ?? "";

  console.log("[Zoom OAuth] client_id:", clientId);
  console.log("[Zoom OAuth] redirect_uri:", callbackUri);

  const REDIRECT_URI = "http://localhost:3000/api/auth/zoom/callback";

  console.log("[Zoom OAuth] client_id:", clientId);
  console.log("[Zoom OAuth] redirect_uri:", REDIRECT_URI);
  console.log("[Zoom OAuth] full URL:", `https://zoom.us/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${encodeURIComponent(session.user.email)}`);

  const params = new URLSearchParams({
    response_type: "code",
    client_id:     clientId,
    redirect_uri:  REDIRECT_URI,
    state:         session.user.email,
  });

  return NextResponse.redirect(
    `https://zoom.us/oauth/authorize?${params.toString()}`,
  );
}

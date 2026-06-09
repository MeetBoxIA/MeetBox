/**
 * GET /api/desktop/jobs/[id]
 * Returns the current status of a processing job. Used by the desktop client
 * to poll progress when Realtime is unavailable.
 *
 * Auth: Bearer desktop token.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateDesktopRequest } from "@/lib/desktop-auth";
import { JobsRepo } from "@/lib/repositories/pipeline-repo";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateDesktopRequest(req);
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401, headers: CORS });

  const { id } = await params;
  const job = await JobsRepo.getById(id, auth.userId);
  if (!job) return NextResponse.json({ error: "Job no encontrado" }, { status: 404, headers: CORS });

  return NextResponse.json({
    job_id:       job.id,
    status:       job.status,
    progress:     job.progress_pct,
    session_id:   job.session_id,
    error:        job.last_error,
    error_step:   job.error_step,
    completed_at: job.completed_at,
  }, { headers: CORS });
}

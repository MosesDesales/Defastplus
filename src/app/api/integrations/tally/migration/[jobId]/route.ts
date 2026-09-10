import { NextResponse } from "next/server";
import { requireApiModules } from "@/lib/api-require-module";
import { getMigrationJob } from "@/lib/tally/migration-service";
import { getSession } from "@/lib/session";

/** GET /api/integrations/tally/migration/[jobId] */
export async function GET(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "tally");
  if (denied) return denied;

  const { jobId } = await ctx.params;
  const job = await getMigrationJob(session.sub, jobId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    job: {
      ...job,
      stats: job.statsJson ? JSON.parse(job.statsJson) : null,
      reconcile: job.reconcileJson ? JSON.parse(job.reconcileJson) : null,
      phases: job.phasesJson ? JSON.parse(job.phasesJson) : null,
      snapshot: job.snapshot
        ? { ...job.snapshot, parsed: job.snapshot.parsedJson ? JSON.parse(job.snapshot.parsedJson) : null }
        : null,
    },
  });
}

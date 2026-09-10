import { NextResponse } from "next/server";
import { requireApiModules } from "@/lib/api-require-module";
import { listMigrationJobs } from "@/lib/tally/migration-service";
import { getSession } from "@/lib/session";

/** GET /api/integrations/tally/migration — list jobs */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "tally");
  if (denied) return denied;

  const jobs = await listMigrationJobs(session.sub);
  return NextResponse.json({ jobs });
}

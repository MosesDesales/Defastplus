import { NextResponse } from "next/server";
import { requireSuperUserApi, superAdminErrorResponse } from "@/lib/superadmin/guard";
import { usersToCsv } from "@/lib/superadmin/csv";
import { listUsersForExport, recordExport } from "@/lib/superadmin/service";
import { searchParamsToObject, userListQuerySchema } from "@/lib/superadmin/validators";

/** CSV of the current filter (up to EXPORT_LIMIT rows). Every export is audited. */
export async function GET(request: Request) {
  const session = await requireSuperUserApi();
  if (session instanceof NextResponse) return session;
  try {
    const raw = searchParamsToObject(new URL(request.url).searchParams);
    const q = userListQuerySchema.parse({ ...raw, page: 1, pageSize: 100 });
    const users = await listUsersForExport(q);
    await recordExport(session.sub, users.length, raw);
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(usersToCsv(users), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="fastplus-users-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return superAdminErrorResponse(e);
  }
}

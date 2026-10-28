import { redirect } from "next/navigation";
import Link from "next/link";
import { DashboardHomeClient } from "@/components/dashboard/DashboardHomeClient";
import { getDashboardSummary } from "@/lib/dashboard-summary";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type DashboardPageProps = {
  searchParams: Promise<{ module?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const sp = await searchParams;

  const [summary, user] = await Promise.all([
    getDashboardSummary(session.sub),
    prisma.user.findUnique({
      where: { id: session.sub },
      select: { name: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      {sp.module === "unassigned" ? (
        <div
          role="status"
          className="mx-auto max-w-7xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
        >
          That module is not included in your subscription or has not been assigned to your account. Contact your
          administrator to request access.
        </div>
      ) : null}
      {sp.module === "disabled" ? (
        <div
          role="status"
          className="mx-auto max-w-7xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
        >
          That area is turned off for your organization. An administrator can enable it under{" "}
          <Link href="/settings/general" className="font-semibold underline">
            Settings → General
          </Link>
          .
        </div>
      ) : null}
      <DashboardHomeClient initial={summary} userName={user?.name ?? session.name} />
    </div>
  );
}

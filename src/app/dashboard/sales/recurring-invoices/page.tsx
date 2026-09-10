import Link from "next/link";
import { redirect } from "next/navigation";
import { RecurringInvoicesListClient } from "@/components/sales/RecurringInvoicesListClient";
import { getSession } from "@/lib/session";

export default async function RecurringInvoicesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Sales</p>
      <div className="mt-1 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Recurring invoices</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Templates generate real invoices on schedule. Run{" "}
            <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">POST /api/cron/recurring-sales</code> daily
            (same auth as purchases cron).
          </p>
        </div>
        <Link
          href="/dashboard/sales/recurring-invoices/new"
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 dark:bg-teal-500"
        >
          + New template
        </Link>
      </div>
      <RecurringInvoicesListClient />
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, CalendarDays, Users } from "lucide-react";
import { getSession } from "@/lib/session";

export default async function HrHomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">HR & Payroll</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Human resources</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/dashboard/hr/employees" className="flex gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700">
          <Users className="h-10 w-10 text-teal-600 dark:text-teal-400" />
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">Employees</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Directory, bank & tax IDs, salary linkage.</p>
          </div>
        </Link>
        <Link href="/dashboard/hr/leave" className="flex gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700">
          <CalendarDays className="h-10 w-10 text-teal-600 dark:text-teal-400" />
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">Leave</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Leave types, annual quotas, and recorded leave per employee.</p>
          </div>
        </Link>
        <Link href="/dashboard/hr/payroll" className="flex gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700">
          <Briefcase className="h-10 w-10 text-teal-600 dark:text-teal-400" />
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">Payroll</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Structures, payslips, and accrual journals.</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

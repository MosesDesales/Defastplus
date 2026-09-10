import { redirect } from "next/navigation";
import { EmployeesClient } from "@/components/hr/EmployeesClient";
import { getSession } from "@/lib/session";

export default async function EmployeesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase text-teal-600 dark:text-teal-400">HR</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Employees</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Employee IDs are generated automatically. Link salary structures from Payroll setup.</p>
      </div>
      <EmployeesClient />
    </div>
  );
}

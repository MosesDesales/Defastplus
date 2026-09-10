import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Coins, Shield, Users } from "lucide-react";
import { getSession } from "@/lib/session";

export default async function SettingsHomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Settings</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Workspace</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/settings/profile" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700">
          <Building2 className="h-8 w-8 text-teal-600 dark:text-teal-400" />
          <h2 className="mt-3 font-semibold text-slate-900 dark:text-white">Profile</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Company, GSTIN, FY, currency, password.</p>
        </Link>
        <Link href="/settings/currencies" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700">
          <Coins className="h-8 w-8 text-teal-600 dark:text-teal-400" />
          <h2 className="mt-3 font-semibold text-slate-900 dark:text-white">Currencies</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Codes, symbols, base currency, and FX rates.</p>
        </Link>
        <Link href="/dashboard/settings/users" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700">
          <Users className="h-8 w-8 text-teal-600 dark:text-teal-400" />
          <h2 className="mt-3 font-semibold text-slate-900 dark:text-white">Users</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Invite roster entries & assign roles.</p>
        </Link>
        <Link href="/dashboard/settings/roles" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700">
          <Shield className="h-8 w-8 text-teal-600 dark:text-teal-400" />
          <h2 className="mt-3 font-semibold text-slate-900 dark:text-white">Roles</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Custom roles & permission matrix.</p>
        </Link>
      </div>
    </div>
  );
}

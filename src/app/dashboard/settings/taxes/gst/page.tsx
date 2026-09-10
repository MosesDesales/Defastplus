import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRoundSearch } from "lucide-react";
import { GstSettingsClient } from "@/components/settings/GstSettingsClient";
import { getSession } from "@/lib/session";

export default async function GstSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">Taxes</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">GST Settings</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Registration and filing preferences for Indian GST. GSTR-2A and GSTR-3B use your GSTIN and books data.
          </p>
        </div>
        <Link
          href="/dashboard/settings/upcoming?k=find-accountants"
          className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-sky-700 hover:underline dark:text-sky-400"
        >
          <UserRoundSearch className="h-4 w-4" aria-hidden />
          Find accountants
        </Link>
      </header>
      <GstSettingsClient />
    </div>
  );
}

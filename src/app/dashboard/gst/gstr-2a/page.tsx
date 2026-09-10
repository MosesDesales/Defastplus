import Link from "next/link";
import { redirect } from "next/navigation";
import { Gstr2aClient } from "@/components/gst/Gstr2aClient";
import { getSession } from "@/lib/session";

export default async function Gstr2aPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/dashboard/gst" className="text-xs font-semibold uppercase text-teal-600 hover:underline dark:text-teal-400">
            ← GST
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">GSTR-2A (purchase register)</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Derived from vendor bills. Set company GSTIN under Settings → Profile for intra/inter-state split.</p>
        </div>
      </div>
      <Gstr2aClient />
    </div>
  );
}

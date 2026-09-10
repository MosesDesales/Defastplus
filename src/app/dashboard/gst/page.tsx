import Link from "next/link";
import { redirect } from "next/navigation";
import { FileSpreadsheet, Landmark } from "lucide-react";
import { getSession } from "@/lib/session";

export default async function GstHomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">GST (India)</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">GST Compliance</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Purchase data from Bills feeds GSTR-2A style reconciliation; sales & purchases roll into GSTR-3B summaries.
        </p>
      </div>
      <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm text-sky-950 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-100">
        <span className="font-medium">GST registration & preferences</span> —{" "}
        <Link className="font-semibold underline underline-offset-2 hover:no-underline" href="/dashboard/settings/taxes/gst">
          open GST Settings
        </Link>{" "}
        under Settings → Taxes.
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/dashboard/gst/gstr-2a"
          className="flex gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950/50">
            <FileSpreadsheet className="h-6 w-6 text-teal-700 dark:text-teal-400" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">GSTR-2A</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Auto-drafted purchases from vendor bills — match & reconcile.</p>
          </div>
        </Link>
        <Link
          href="/dashboard/gst/gstr-3b"
          className="flex gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950/50">
            <Landmark className="h-6 w-6 text-teal-700 dark:text-teal-400" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">GSTR-3B</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Monthly outward / inward tax summary with export.</p>
          </div>
        </Link>
        <Link
          href="/dashboard/gst/eway-bills"
          className="flex gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700 sm:col-span-2"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950/50">
            <FileSpreadsheet className="h-6 w-6 text-teal-700 dark:text-teal-400" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">E-Way Bills</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Generate, update vehicles, cancel, and track E-Way Bills from invoices and other documents.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}

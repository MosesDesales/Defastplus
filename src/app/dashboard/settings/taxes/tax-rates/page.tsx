import Link from "next/link";
import { redirect } from "next/navigation";
import { Package } from "lucide-react";
import { getSession } from "@/lib/session";

export default async function TaxRatesSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">Taxes</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Tax rates</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Item-level GST rates, HSN/SAC, and tax preferences are maintained on inventory items. Use GST Settings for
          registration details.
        </p>
      </header>
      <Link
        href="/dashboard/inventory/items"
        className="flex max-w-md items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700"
      >
        <Package className="h-10 w-10 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-white">Manage items & GST</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Open the item catalog to edit per-item tax rates.</p>
        </div>
      </Link>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getEffectiveModuleSettings } from "@/lib/organization-settings-db";
import { getSession } from "@/lib/session";

export default async function ReportsHubPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const modules = await getEffectiveModuleSettings(session.sub);

  const links = [
    { href: "/dashboard/reports/pnl", label: "Profit & Loss", desc: "Income, expenses, and net profit from posted journals." },
    { href: "/dashboard/reports/balance-sheet", label: "Balance Sheet", desc: "Assets, liabilities, and equity." },
    { href: "/dashboard/reports/trial-balance", label: "Trial Balance", desc: "Debits and credits by account for a period." },
  ];

  const fixedAssetLinks = modules.fixedAssetsEnabled
    ? [
        {
          href: "/dashboard/reports/fixed-asset-register",
          label: "Fixed asset register",
          desc: "Cost, accumulated depreciation, and book value for each capital asset.",
        },
        {
          href: "/dashboard/reports/depreciation-schedule",
          label: "Depreciation schedule",
          desc: "Posted and projected depreciation by asset.",
        },
        {
          href: "/dashboard/reports/asset-disposals",
          label: "Asset disposals",
          desc: "Proceeds, gain or loss, and disposal journals.",
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Reports</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">Financial reports</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Ledger-driven statements. Use the Accounting menu for quick access.</p>
      <ul className="mt-8 space-y-3">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700">
              <span className="font-medium text-teal-800 dark:text-teal-300">{l.label}</span>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{l.desc}</p>
            </Link>
          </li>
        ))}
        {fixedAssetLinks.length ? (
          <li className="pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Fixed assets</p>
            <ul className="space-y-3">
              {fixedAssetLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700">
                    <span className="font-medium text-teal-800 dark:text-teal-300">{l.label}</span>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{l.desc}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

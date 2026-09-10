import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, Building2, FileSpreadsheet, Landmark, SlidersHorizontal } from "lucide-react";
import { getSession } from "@/lib/session";

const links = [
  {
    href: "/settings/general",
    label: "Module availability",
    desc: "Enable or disable sales, purchases, inventory, integrations, and more for your workspace.",
    Icon: SlidersHorizontal,
  },
  {
    href: "/settings/profile",
    label: "Company defaults",
    desc: "Name, GSTIN, FY start, currency, and billing address.",
    Icon: Building2,
  },
  {
    href: "/dashboard/accounting/chart-of-accounts",
    label: "Chart of accounts",
    desc: "Accounts, types, and opening structure for the ledger.",
    Icon: BookOpen,
  },
  {
    href: "/dashboard/accounting/general-ledger",
    label: "General ledger",
    desc: "Posted activity and balances by account.",
    Icon: FileSpreadsheet,
  },
  {
    href: "/dashboard/banking",
    label: "Banking & payments",
    desc: "Cash and bank movement (module expands over time).",
    Icon: Landmark,
  },
] as const;

export default async function SetupGeneralPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase text-teal-600 dark:text-teal-400">Setup & configurations</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">General</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Core workspace setup. Open a destination to continue configuration. Use{" "}
          <Link href="/settings/general" className="font-medium text-teal-700 underline dark:text-teal-400">
            General (modules)
          </Link>{" "}
          to control sidebar visibility and API access.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {links.map(({ href, label, desc, Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700"
            >
              <Icon className="h-8 w-8 text-teal-600 dark:text-teal-400" aria-hidden />
              <span className="mt-3 font-semibold text-slate-900 dark:text-white">{label}</span>
              <span className="mt-1 text-sm text-slate-600 dark:text-slate-400">{desc}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

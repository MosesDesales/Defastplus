import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, Cable, FileSpreadsheet, Landmark } from "lucide-react";
import { getSession } from "@/lib/session";

const cards = [
  {
    href: "/dashboard/integrations/tally",
    title: "Tally",
    desc: "Push ledgers and vouchers via XML to a local Tally bridge (e.g. localhost:9000).",
    Icon: FileSpreadsheet,
  },
  {
    href: "/dashboard/integrations/zoho-books",
    title: "Zoho Books",
    desc: "OAuth 2.0 — sync contacts, invoices, and payments (integration shell).",
    Icon: BookOpen,
  },
  {
    href: "/dashboard/integrations/quickbooks",
    title: "QuickBooks",
    desc: "Intuit OAuth — customers, invoices, expenses, and payments (integration shell).",
    Icon: Landmark,
  },
] as const;

export default async function IntegrationsHubPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">Integrations</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Books</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Connect external accounting systems. Credentials are encrypted; sync runs through server APIs and is logged below
          each integration.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map(({ href, title, desc, Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700"
          >
            <Icon className="h-9 w-9 text-teal-600 dark:text-teal-400" aria-hidden />
            <h2 className="mt-3 font-semibold text-slate-900 dark:text-white">{title}</h2>
            <p className="mt-2 flex-1 text-sm text-slate-600 dark:text-slate-400">{desc}</p>
            <span className="mt-4 text-sm font-semibold text-teal-700 dark:text-teal-400">Configure →</span>
          </Link>
        ))}
      </div>
      <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300">
        <Cable className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden />
        <p>
          Use <strong>POST /api/integrations/connect</strong>, <strong>POST /api/integrations/sync</strong>, and{" "}
          <strong>GET /api/integrations/logs</strong> from the server or automation — never expose client secrets to the browser
          network beyond this signed-in session.
        </p>
      </div>
    </div>
  );
}

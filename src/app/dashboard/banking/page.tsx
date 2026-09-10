import Link from "next/link";
import { redirect } from "next/navigation";
import { Landmark, List, Scale, Upload } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function BankingOverviewPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const accounts = await prisma.bankingAccount.findMany({
    where: { userId: session.sub },
    select: { id: true },
  });

  const cards = [
    {
      href: "/banking/accounts",
      title: "Bank accounts",
      desc: "Add operating accounts, opening balances, and GL links.",
      icon: Landmark,
    },
    {
      href: "/banking/statement-upload",
      title: "Statement upload",
      desc: "CSV import with preview before posting lines.",
      icon: Upload,
    },
    {
      href: "/banking/transactions",
      title: "Transactions",
      desc: "Review imported lines, status, and balances.",
      icon: List,
    },
    {
      href: "/banking/reconciliation",
      title: "Reconciliation",
      desc: "Match bank lines to invoices, bills, expenses, or vendor payments.",
      icon: Scale,
    },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {accounts.length === 0 ? (
          <>
            No bank accounts yet —{" "}
            <Link href="/banking/accounts" className="font-medium text-teal-700 underline dark:text-teal-400">
              create your first account
            </Link>{" "}
            to import a statement.
          </>
        ) : (
          <>
            {accounts.length} bank account{accounts.length === 1 ? "" : "s"} on file. Open an account card from{" "}
            <Link href="/banking/accounts" className="font-medium text-teal-700 underline dark:text-teal-400">
              Bank accounts
            </Link>{" "}
            for balances and unreconciled counts.
          </>
        )}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.href}
              href={c.href}
              className="group flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300">
                <Icon className="h-6 w-6" aria-hidden />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white">{c.title}</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{c.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

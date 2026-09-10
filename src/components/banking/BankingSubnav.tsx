"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/banking", label: "Overview" },
  { href: "/banking/accounts", label: "Bank accounts" },
  { href: "/banking/transactions", label: "Transactions" },
  { href: "/banking/reconciliation", label: "Reconciliation" },
  { href: "/banking/statement-upload", label: "Statement upload" },
  { href: "/banking/rules", label: "Rules" },
] as const;

export function BankingSubnav() {
  const pathname = usePathname();
  const normPath = pathname.startsWith("/dashboard/banking")
    ? pathname.slice("/dashboard".length) || "/banking"
    : pathname;

  return (
    <nav className="mb-8 flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800" aria-label="Banking">
      {LINKS.map((l) => {
        const active =
          l.href === "/banking"
            ? normPath === "/banking" || normPath === "/banking/"
            : normPath === l.href || normPath.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-teal-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

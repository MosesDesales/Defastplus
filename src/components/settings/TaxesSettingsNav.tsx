"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function cx(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

const links = [
  { href: "/dashboard/settings/taxes/tax-rates", label: "Tax Rates" },
  { href: "/dashboard/settings/taxes/gst", label: "GST Settings" },
] as const;

export function TaxesSettingsNav() {
  const pathname = usePathname() ?? "";

  return (
    <aside className="w-full shrink-0 lg:w-56">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Taxes</p>
      <nav className="mt-3 flex flex-col gap-0.5 border-l border-slate-200 pl-3 dark:border-slate-700">
        {links.map(({ href, label }) => {
          const active = pathname === href || (href === "/dashboard/settings/taxes/gst" && pathname === "/dashboard/settings/taxes");
          return (
            <Link
              key={href}
              href={href}
              className={cx(
                "rounded-md py-2 pl-3 text-sm transition",
                active
                  ? "border-l-2 border-sky-600 bg-slate-100 font-medium text-slate-900 -ml-px pl-[11px] dark:border-sky-500 dark:bg-slate-800 dark:text-white"
                  : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/80",
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useOrganizationModuleSettings } from "@/components/organization-module-settings-context";
import { SALES_MODULE_ICONS } from "@/lib/sales-module-icons";
import { salesModulesForSettings } from "@/lib/sales-modules";
import { hrefForSalesSlug } from "@/lib/sales-nav";

export function SalesHomeClient() {
  const { settings, loaded } = useOrganizationModuleSettings();

  const modules = useMemo(
    () => (loaded ? salesModulesForSettings(settings) : []),
    [loaded, settings],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Sales</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Sales</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Money coming in from customers — quotes, invoices, payments, credit notes, and recurring billing. Open a
          sub-module below or from the sidebar to focus on one workflow.
        </p>
      </div>

      {!loaded ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => {
            const Icon = SALES_MODULE_ICONS[m.slug];
            const href = hrefForSalesSlug(m.slug);
            return (
              <Link
                key={m.slug}
                href={href}
                className="flex gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700"
              >
                <Icon className="h-10 w-10 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
                <div className="min-w-0">
                  <h2 className="font-semibold text-slate-900 dark:text-white">{m.label}</h2>
                  <p className="mt-1 text-sm leading-snug text-slate-600 dark:text-slate-400">{m.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {loaded && modules.length === 0 ? (
        <p className="text-sm text-slate-500">
          No sales sub-modules are enabled. Turn them on under Settings → General.
        </p>
      ) : null}
    </div>
  );
}

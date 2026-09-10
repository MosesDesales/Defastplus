"use client";

import Link from "next/link";

export function EWayBillReportsClient() {
  const links = [
    { type: "generated", label: "Generated E-Way Bills" },
    { type: "expired", label: "Expired E-Way Bills" },
    { type: "cancelled", label: "Cancelled E-Way Bills" },
  ];
  const formats = ["csv", "xlsx", "pdf"] as const;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/dashboard/gst/eway-bills" className="text-sm font-medium text-teal-600 hover:underline">
        ← E-Way Bills
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">E-Way Bill Reports</h1>
      <p className="text-sm text-slate-600">Export summaries by customer and state (JSON via API). Download CSV, Excel, or PDF.</p>

      <div className="space-y-4">
        {links.map((r) => (
          <div key={r.type} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <h2 className="font-medium text-slate-900 dark:text-white">{r.label}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {formats.map((fmt) => (
                <a
                  key={fmt}
                  href={`/api/gst/eway-bills/reports?type=${r.type}&format=${fmt}`}
                  className="rounded border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50 dark:border-slate-600"
                >
                  {fmt.toUpperCase()}
                </a>
              ))}
              <a
                href={`/api/gst/eway-bills/reports?type=${r.type}&format=json`}
                className="rounded border border-teal-200 px-3 py-1 text-sm text-teal-700 hover:bg-teal-50"
              >
                JSON summary
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

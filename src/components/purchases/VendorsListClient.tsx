"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { parseResponseJson } from "@/lib/parse-response-json";

type VendorRow = {
  id: string;
  displayName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  isActive: boolean;
};

export function VendorsListClient() {
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/purchases/vendors", { cache: "no-store" });
    const data = await parseResponseJson<{ vendors?: VendorRow[] }>(res, {});
    setRows(data.vendors ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = search.trim()
    ? rows.filter(
        (r) =>
          r.displayName.toLowerCase().includes(search.toLowerCase()) ||
          (r.companyName?.toLowerCase().includes(search.toLowerCase()) ?? false),
      )
    : rows;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Purchases</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Vendors</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Suppliers you purchase from — drives bills and payables.</p>
        </div>
        <Link
          href="/dashboard/purchases/vendors/new"
          className="inline-flex justify-center rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 dark:bg-teal-500"
        >
          Add vendor
        </Link>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="Search vendor name or company"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950">
              <tr>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">GST/VAT</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    No vendors yet.
                  </td>
                </tr>
              ) : (
                filtered.map((v) => (
                  <tr key={v.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{v.displayName}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{v.companyName ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {[v.email, v.phone].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{v.gstin ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          v.isActive
                            ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800"
                        }
                      >
                        {v.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/dashboard/purchases/vendors/${v.id}`} className="font-medium text-teal-600 hover:underline dark:text-teal-400">
                        Profile
                      </Link>
                      <span className="mx-2 text-slate-300">|</span>
                      <Link href={`/dashboard/purchases/vendors/${v.id}/edit`} className="font-medium text-slate-700 hover:underline dark:text-slate-300">
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

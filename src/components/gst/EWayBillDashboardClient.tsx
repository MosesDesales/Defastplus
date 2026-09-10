"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EWAY_STATUS_LABELS } from "@/lib/eway/constants";
import type { EWayBillStatus } from "@prisma/client";

type Stats = {
  total: number;
  generatedToday: number;
  active: number;
  expired: number;
  cancelled: number;
  pending: number;
  failed: number;
};

type Row = {
  id: string;
  status: EWayBillStatus;
  statusLabel: string;
  sourceDocumentNumber: string;
  documentValue: number;
  ewayBillNumber: string | null;
  customerName: string;
  vehicleNumber: string | null;
  createdAt: string;
};

const STATUS_OPTIONS: EWayBillStatus[] = [
  "DRAFT",
  "READY",
  "GENERATED",
  "IN_TRANSIT",
  "EXPIRED",
  "CANCELLED",
  "ERROR",
];

export function EWayBillDashboardClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [items, setItems] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    gstin: "",
    invoiceNumber: "",
    vehicleNumber: "",
    status: "",
  });

  const load = useCallback(async () => {
    setErr(null);
    const qs = new URLSearchParams();
    if (filters.from) qs.set("from", filters.from);
    if (filters.to) qs.set("to", filters.to);
    if (filters.gstin) qs.set("gstin", filters.gstin);
    if (filters.invoiceNumber) qs.set("invoiceNumber", filters.invoiceNumber);
    if (filters.vehicleNumber) qs.set("vehicleNumber", filters.vehicleNumber);
    if (filters.status) qs.set("status", filters.status);

    const [statsRes, listRes] = await Promise.all([
      fetch("/api/gst/eway-bills/dashboard", { credentials: "include" }),
      fetch(`/api/gst/eway-bills?${qs}`, { credentials: "include" }),
    ]);

    if (!statsRes.ok || !listRes.ok) {
      setErr("Could not load E-Way Bill dashboard");
      return;
    }
    setStats(await statsRes.json());
    const list = await listRes.json();
    setItems(list.items ?? []);
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const cards = stats
    ? [
        { label: "Total", value: stats.total },
        { label: "Generated Today", value: stats.generatedToday },
        { label: "Active", value: stats.active, color: "text-emerald-700" },
        { label: "Expired", value: stats.expired, color: "text-amber-700" },
        { label: "Cancelled", value: stats.cancelled, color: "text-slate-600" },
        { label: "Pending", value: stats.pending, color: "text-blue-700" },
        { label: "Failed", value: stats.failed, color: "text-red-700" },
      ]
    : [];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-teal-600">GST · Logistics</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">E-Way Bills</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Generate, track, and manage E-Way Bills for invoices and other supply documents.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/gst/eway-bills/settings"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
          >
            Settings
          </Link>
          <Link
            href="/dashboard/gst/eway-bills/reports"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
          >
            Reports
          </Link>
          <Link
            href="/dashboard/sales/invoices"
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            From document
          </Link>
        </div>
      </header>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <p className="text-xs font-medium uppercase text-slate-500">{c.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${c.color ?? "text-slate-900 dark:text-white"}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Filters</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <FilterInput label="From" type="date" value={filters.from} onChange={(v) => setFilters((f) => ({ ...f, from: v }))} />
          <FilterInput label="To" type="date" value={filters.to} onChange={(v) => setFilters((f) => ({ ...f, to: v }))} />
          <FilterInput label="GSTIN" value={filters.gstin} onChange={(v) => setFilters((f) => ({ ...f, gstin: v }))} />
          <FilterInput
            label="Invoice No"
            value={filters.invoiceNumber}
            onChange={(v) => setFilters((f) => ({ ...f, invoiceNumber: v }))}
          />
          <FilterInput
            label="Vehicle"
            value={filters.vehicleNumber}
            onChange={(v) => setFilters((f) => ({ ...f, vehicleNumber: v }))}
          />
          <label className="block text-xs font-medium text-slate-500">
            Status
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">All</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {EWAY_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 dark:bg-slate-700"
        >
          Apply filters
        </button>
      </section>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full min-w-[48rem] border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500 dark:bg-slate-950">
            <tr>
              <th className="px-3 py-2">EBN / Doc</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Value</th>
              <th className="px-3 py-2">Vehicle</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  No E-Way Bills yet. Create one from a sales invoice.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <td className="px-3 py-2">
                    <Link href={`/dashboard/gst/eway-bills/${row.id}`} className="font-medium text-teal-600 hover:underline">
                      {row.ewayBillNumber ?? row.sourceDocumentNumber}
                    </Link>
                    {row.ewayBillNumber ? (
                      <p className="text-xs text-slate-500">{row.sourceDocumentNumber}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{row.customerName}</td>
                  <td className="px-3 py-2">
                    <StatusPill status={row.status} label={row.statusLabel} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.documentValue.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                  </td>
                  <td className="px-3 py-2">{row.vehicleNumber ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                    {new Date(row.createdAt).toLocaleDateString("en-IN")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-xs font-medium text-slate-500">
      {label}
      <input
        type={type}
        className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function StatusPill({ status, label }: { status: EWayBillStatus; label: string }) {
  const colors: Record<EWayBillStatus, string> = {
    DRAFT: "bg-slate-100 text-slate-700",
    READY: "bg-blue-100 text-blue-800",
    GENERATED: "bg-emerald-100 text-emerald-800",
    IN_TRANSIT: "bg-indigo-100 text-indigo-800",
    EXPIRED: "bg-amber-100 text-amber-900",
    CANCELLED: "bg-slate-200 text-slate-600",
    ERROR: "bg-red-100 text-red-800",
  };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[status]}`}>{label}</span>;
}

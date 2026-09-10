"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EWAY_DOCUMENT_TYPE_LABELS, EWAY_STATUS_LABELS, EWAY_TRANSPORT_MODE_LABELS } from "@/lib/eway/constants";
import type { EWayBillStatus, EWayTransportMode } from "@prisma/client";

type Bill = {
  id: string;
  status: EWayBillStatus;
  documentType: keyof typeof EWAY_DOCUMENT_TYPE_LABELS;
  sourceDocumentNumber: string;
  sourceDocumentDate: string;
  documentValue: number;
  ewayBillNumber: string | null;
  generatedAt: string | null;
  validUntil: string | null;
  qrCodeData: string | null;
  errorMessage: string | null;
  supplierName: string;
  supplierGstin: string | null;
  supplierAddress: string | null;
  recipientName: string;
  recipientGstin: string | null;
  recipientAddress: string | null;
  transportMode: EWayTransportMode;
  vehicleNumber: string | null;
  distanceKm: number | null;
  transporterName: string | null;
  lines: Array<{ productName: string; hsnCode: string | null; quantity: number; unit: string; taxableValue: number }>;
  vehicleUpdates: Array<{ vehicleNumber: string; createdAt: string; reason: string | null }>;
  statusHistory: Array<{ toStatus: EWayBillStatus; note: string | null; createdAt: string }>;
};

export function EWayBillDetailClient({ id }: { id: string }) {
  const [bill, setBill] = useState<Bill | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [transport, setTransport] = useState({ vehicleNumber: "", distanceKm: "", transportMode: "ROAD" as EWayTransportMode });
  const [vehicleUpdate, setVehicleUpdate] = useState({ vehicleNumber: "", reason: "" });
  const [emailTo, setEmailTo] = useState("");

  const load = useCallback(async () => {
    setErr(null);
    const res = await fetch(`/api/gst/eway-bills/${id}`, { credentials: "include" });
    if (!res.ok) {
      setErr("Could not load E-Way Bill");
      return;
    }
    const data = await res.json();
    setBill(data);
    setTransport({
      vehicleNumber: data.vehicleNumber ?? "",
      distanceKm: data.distanceKm != null ? String(data.distanceKm) : "",
      transportMode: data.transportMode ?? "ROAD",
    });
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveTransport() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/gst/eway-bills/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleNumber: transport.vehicleNumber,
        distanceKm: transport.distanceKm ? Number(transport.distanceKm) : undefined,
        transportMode: transport.transportMode,
        status: "READY",
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr((await res.json().catch(() => ({}))).error ?? "Save failed");
      return;
    }
    setMsg("Transport details saved — ready for submission.");
    void load();
  }

  async function generate() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/gst/eway-bills/${id}/generate`, { method: "POST", credentials: "include" });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(data.error ?? "Generation failed");
      void load();
      return;
    }
    setMsg(`E-Way Bill generated: ${data.bill?.ewayBillNumber ?? "OK"}`);
    void load();
  }

  async function cancelBill() {
    const reason = window.prompt("Cancellation reason (required):")?.trim();
    if (!reason || reason.length < 3) return;
    setBusy(true);
    const res = await fetch(`/api/gst/eway-bills/${id}/cancel`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr((await res.json().catch(() => ({}))).error ?? "Cancel failed");
      return;
    }
    setMsg("E-Way Bill cancelled.");
    void load();
  }

  async function updateVehicle() {
    setBusy(true);
    const res = await fetch(`/api/gst/eway-bills/${id}/vehicle`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vehicleUpdate),
    });
    setBusy(false);
    if (!res.ok) {
      setErr((await res.json().catch(() => ({}))).error ?? "Vehicle update failed");
      return;
    }
    setMsg("Vehicle updated.");
    setVehicleUpdate({ vehicleNumber: "", reason: "" });
    void load();
  }

  async function extendValidity() {
    setBusy(true);
    const res = await fetch(`/api/gst/eway-bills/${id}/extend`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Transit delay" }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr((await res.json().catch(() => ({}))).error ?? "Extension failed");
      return;
    }
    setMsg("Validity extended.");
    void load();
  }

  async function sendEmail() {
    if (!emailTo.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/gst/eway-bills/${id}/email`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: emailTo }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr((await res.json().catch(() => ({}))).error ?? "Email failed");
      return;
    }
    setMsg("Email sent.");
  }

  if (err && !bill) return <p className="text-sm text-red-600">{err}</p>;
  if (!bill) return <p className="text-sm text-slate-500">Loading…</p>;

  const canEdit = ["DRAFT", "READY", "ERROR"].includes(bill.status);
  const canGenerate = ["DRAFT", "READY", "ERROR"].includes(bill.status) && !bill.ewayBillNumber;
  const hasEbn = Boolean(bill.ewayBillNumber);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/gst/eway-bills" className="text-sm font-medium text-teal-600 hover:underline">
        ← E-Way Bills
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            {bill.ewayBillNumber ?? bill.sourceDocumentNumber}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {EWAY_DOCUMENT_TYPE_LABELS[bill.documentType]} · {EWAY_STATUS_LABELS[bill.status]}
          </p>
          {bill.errorMessage ? <p className="mt-2 text-sm text-red-600">{bill.errorMessage}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/gst/eway-bills/${id}/pdf`}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-700"
            target="_blank"
            rel="noreferrer"
          >
            PDF
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-700"
          >
            Print
          </button>
          {canGenerate ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void generate()}
              className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              Generate E-Way Bill
            </button>
          ) : null}
          {hasEbn && bill.status !== "CANCELLED" ? (
            <>
              <button type="button" disabled={busy} onClick={() => void extendValidity()} className="rounded-lg border px-3 py-1.5 text-sm">
                Extend validity
              </button>
              <button type="button" disabled={busy} onClick={() => void cancelBill()} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700">
                Cancel
              </button>
            </>
          ) : null}
        </div>
      </header>

      {msg ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</p> : null}
      {err ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <InfoCard title="Consignor">
          <p className="font-medium">{bill.supplierName}</p>
          {bill.supplierGstin ? <p className="text-sm text-slate-600">GSTIN: {bill.supplierGstin}</p> : null}
          {bill.supplierAddress ? <p className="text-sm text-slate-600">{bill.supplierAddress}</p> : null}
        </InfoCard>
        <InfoCard title="Consignee">
          <p className="font-medium">{bill.recipientName}</p>
          {bill.recipientGstin ? <p className="text-sm text-slate-600">GSTIN: {bill.recipientGstin}</p> : null}
          {bill.recipientAddress ? <p className="text-sm text-slate-600">{bill.recipientAddress}</p> : null}
        </InfoCard>
      </div>

      {canEdit ? (
        <InfoCard title="Transport (required before generation)">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-slate-500">
              Mode
              <select
                className="mt-1 w-full rounded border px-2 py-1.5 text-sm dark:bg-slate-950"
                value={transport.transportMode}
                onChange={(e) => setTransport((t) => ({ ...t, transportMode: e.target.value as EWayTransportMode }))}
              >
                {Object.entries(EWAY_TRANSPORT_MODE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-500">
              Vehicle number
              <input
                className="mt-1 w-full rounded border px-2 py-1.5 text-sm uppercase dark:bg-slate-950"
                value={transport.vehicleNumber}
                onChange={(e) => setTransport((t) => ({ ...t, vehicleNumber: e.target.value }))}
              />
            </label>
            <label className="text-xs text-slate-500">
              Distance (km)
              <input
                type="number"
                min={1}
                className="mt-1 w-full rounded border px-2 py-1.5 text-sm dark:bg-slate-950"
                value={transport.distanceKm}
                onChange={(e) => setTransport((t) => ({ ...t, distanceKm: e.target.value }))}
              />
            </label>
          </div>
          <button type="button" disabled={busy} onClick={() => void saveTransport()} className="mt-3 rounded bg-slate-800 px-3 py-1.5 text-sm text-white">
            Save transport
          </button>
        </InfoCard>
      ) : (
        <InfoCard title="Transport">
          <p className="text-sm">
            {EWAY_TRANSPORT_MODE_LABELS[bill.transportMode]} · {bill.vehicleNumber ?? "—"} · {bill.distanceKm ?? "—"} km
          </p>
          {bill.transporterName ? <p className="text-sm text-slate-600">Transporter: {bill.transporterName}</p> : null}
          {bill.validUntil ? <p className="text-sm text-slate-600">Valid until: {new Date(bill.validUntil).toLocaleString("en-IN")}</p> : null}
        </InfoCard>
      )}

      {hasEbn ? (
        <InfoCard title="Update vehicle (Part-B)">
          <div className="flex flex-wrap gap-2">
            <input
              placeholder="New vehicle number"
              className="rounded border px-2 py-1.5 text-sm uppercase dark:bg-slate-950"
              value={vehicleUpdate.vehicleNumber}
              onChange={(e) => setVehicleUpdate((v) => ({ ...v, vehicleNumber: e.target.value }))}
            />
            <input
              placeholder="Reason"
              className="rounded border px-2 py-1.5 text-sm dark:bg-slate-950"
              value={vehicleUpdate.reason}
              onChange={(e) => setVehicleUpdate((v) => ({ ...v, reason: e.target.value }))}
            />
            <button type="button" disabled={busy} onClick={() => void updateVehicle()} className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white">
              Update vehicle
            </button>
          </div>
        </InfoCard>
      ) : null}

      <InfoCard title="Items">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500">
                <th className="py-1">Product</th>
                <th className="py-1">HSN</th>
                <th className="py-1 text-right">Qty</th>
                <th className="py-1 text-right">Taxable</th>
              </tr>
            </thead>
            <tbody>
              {bill.lines.map((l, i) => (
                <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-1">{l.productName}</td>
                  <td className="py-1">{l.hsnCode ?? "—"}</td>
                  <td className="py-1 text-right tabular-nums">
                    {Number(l.quantity)} {l.unit}
                  </td>
                  <td className="py-1 text-right tabular-nums">{Number(l.taxableValue).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </InfoCard>

      <InfoCard title="Email E-Way Bill">
        <div className="flex flex-wrap gap-2">
          <input
            type="email"
            placeholder="recipient@example.com"
            className="rounded border px-2 py-1.5 text-sm dark:bg-slate-950"
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
          />
          <button type="button" disabled={busy} onClick={() => void sendEmail()} className="rounded border px-3 py-1.5 text-sm">
            Send email
          </button>
        </div>
      </InfoCard>

      {bill.vehicleUpdates.length > 0 ? (
        <InfoCard title="Vehicle history">
          <ul className="space-y-1 text-sm">
            {bill.vehicleUpdates.map((v, i) => (
              <li key={i}>
                {v.vehicleNumber} · {new Date(v.createdAt).toLocaleString("en-IN")}
                {v.reason ? ` · ${v.reason}` : ""}
              </li>
            ))}
          </ul>
        </InfoCard>
      ) : null}

      {bill.statusHistory.length > 0 ? (
        <InfoCard title="Status history">
          <ul className="space-y-1 text-sm">
            {bill.statusHistory.map((h, i) => (
              <li key={i}>
                {EWAY_STATUS_LABELS[h.toStatus]} · {new Date(h.createdAt).toLocaleString("en-IN")}
                {h.note ? ` — ${h.note}` : ""}
              </li>
            ))}
          </ul>
        </InfoCard>
      ) : null}
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

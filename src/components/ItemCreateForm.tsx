"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none ring-teal-600/20 transition focus:border-teal-600 focus:ring-4 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

const labelClass = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

const sectionClass =
  "rounded-xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/40";

export function ItemCreateForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [itemType, setItemType] = useState<"GOODS" | "SERVICE">("GOODS");
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("unit");
  const [salesDescription, setSalesDescription] = useState("");
  const [purchaseDescription, setPurchaseDescription] = useState("");
  const [salesRate, setSalesRate] = useState("");
  const [purchaseRate, setPurchaseRate] = useState("");
  const [sellable, setSellable] = useState(true);
  const [purchasable, setPurchasable] = useState(true);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const sales = salesRate.trim() === "" ? 0 : Number.parseFloat(salesRate);
    const purchase = purchaseRate.trim() === "" ? 0 : Number.parseFloat(purchaseRate);
    if (Number.isNaN(sales) || Number.isNaN(purchase)) {
      setError("Enter valid numbers for rates.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemType,
          name,
          sku: sku.trim() || null,
          unit: unit.trim() || "unit",
          salesDescription: salesDescription.trim() || null,
          purchaseDescription: purchaseDescription.trim() || null,
          salesRate: sales,
          purchaseRate: purchase,
          sellable,
          purchasable,
        }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save item");
        return;
      }

      router.push("/dashboard/inventory/items");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-8">
      {error ? (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div>
        <span className={labelClass}>Type</span>
        <div className="mt-2 flex flex-wrap gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
            <input
              type="radio"
              name="itemType"
              checked={itemType === "GOODS"}
              onChange={() => setItemType("GOODS")}
              className="border-slate-300 text-teal-600 focus:ring-teal-600"
            />
            Goods
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
            <input
              type="radio"
              name="itemType"
              checked={itemType === "SERVICE"}
              onChange={() => setItemType("SERVICE")}
              className="border-slate-300 text-teal-600 focus:ring-teal-600"
            />
            Service
          </label>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="item-name" className={labelClass}>
            Name <span className="text-red-600 dark:text-red-400">*</span>
          </label>
          <input
            id="item-name"
            name="name"
            required
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Consulting hour, Office supplies"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="item-sku" className={labelClass}>
            SKU
          </label>
          <input
            id="item-sku"
            name="sku"
            maxLength={80}
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="Optional"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="item-unit" className={labelClass}>
            Usage unit <span className="text-red-600 dark:text-red-400">*</span>
          </label>
          <input
            id="item-unit"
            name="unit"
            required
            maxLength={40}
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="e.g. box, hour, kg"
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
          <input
            type="checkbox"
            checked={sellable}
            onChange={(e) => setSellable(e.target.checked)}
            className="rounded border-slate-300 text-teal-600 focus:ring-teal-600"
          />
          I sell this item
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
          <input
            type="checkbox"
            checked={purchasable}
            onChange={(e) => setPurchasable(e.target.checked)}
            className="rounded border-slate-300 text-teal-600 focus:ring-teal-600"
          />
          I purchase this item
        </label>
      </div>

      <div className={sectionClass}>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Sales information</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Shown on invoices and quotes when you sell this item.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="sales-desc" className={labelClass}>
              Description
            </label>
            <textarea
              id="sales-desc"
              name="salesDescription"
              rows={2}
              maxLength={2000}
              value={salesDescription}
              onChange={(e) => setSalesDescription(e.target.value)}
              placeholder="Description on sales documents"
              className={inputClass + " resize-y min-h-[4rem]"}
            />
          </div>
          <div>
            <label htmlFor="sales-rate" className={labelClass}>
              Rate
            </label>
            <input
              id="sales-rate"
              name="salesRate"
              inputMode="decimal"
              value={salesRate}
              onChange={(e) => setSalesRate(e.target.value)}
              placeholder="0"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <div className={sectionClass}>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Purchase information</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Shown on bills and POs when you buy this item.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="purchase-desc" className={labelClass}>
              Description
            </label>
            <textarea
              id="purchase-desc"
              name="purchaseDescription"
              rows={2}
              maxLength={2000}
              value={purchaseDescription}
              onChange={(e) => setPurchaseDescription(e.target.value)}
              placeholder="Description on purchase documents"
              className={inputClass + " resize-y min-h-[4rem]"}
            />
          </div>
          <div>
            <label htmlFor="purchase-rate" className={labelClass}>
              Rate
            </label>
            <input
              id="purchase-rate"
              name="purchaseRate"
              inputMode="decimal"
              value={purchaseRate}
              onChange={(e) => setPurchaseRate(e.target.value)}
              placeholder="0"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
        >
          {loading ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

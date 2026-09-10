"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { COMMON_HSN_SAC_HINTS } from "@/lib/gst/common-hsn";
import { GST_RATE_OPTIONS, suggestGstRateForCategoryName } from "@/lib/gst/line-india-tax";

const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-teal-600/20 focus:border-teal-600 focus:ring-4 dark:border-slate-700 dark:bg-slate-950 dark:text-white";
const label = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

type Opt = { id: string; name: string; abbreviation?: string };

type GstPreference = "TAXABLE" | "NON_TAXABLE" | "EXEMPT" | "NIL_RATED";
type GstMode = "AUTO" | "INTRA" | "INTER";

export function InventoryItemForm({
  itemId,
  companyGstin,
}: {
  itemId?: string;
  companyGstin?: string | null;
}) {
  const router = useRouter();
  const isEdit = Boolean(itemId);

  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Opt[]>([]);
  const [units, setUnits] = useState<Opt[]>([]);

  const [gstOpen, setGstOpen] = useState(false);

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [autoSku, setAutoSku] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [inventoryUnitId, setInventoryUnitId] = useState("");
  const [unitFallback, setUnitFallback] = useState("Nos");
  const [purchaseRate, setPurchaseRate] = useState("");
  const [salesRate, setSalesRate] = useState("");
  const [openingStock, setOpeningStock] = useState("");
  const [reorderLevel, setReorderLevel] = useState("0");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [itemType, setItemType] = useState<"GOODS" | "SERVICE">("GOODS");

  const [gstTaxPreference, setGstTaxPreference] = useState<GstPreference>("TAXABLE");
  const [gstApplicable, setGstApplicable] = useState(true);
  const [gstRate, setGstRate] = useState("18");
  const [hsnCode, setHsnCode] = useState("");
  const [gstTaxMode, setGstTaxMode] = useState<GstMode>("AUTO");
  const [reverseCharge, setReverseCharge] = useState(false);
  const [itcEligible, setItcEligible] = useState(true);

  useEffect(() => {
    void (async () => {
      const [c, u] = await Promise.all([
        fetch("/api/inventory/categories").then((r) => r.json()),
        fetch("/api/inventory/units").then((r) => r.json()),
      ]);
      setCategories((c.categories ?? []) as Opt[]);
      setUnits((u.units ?? []) as Opt[]);
      if (itemId) {
        const res = await fetch(`/api/inventory/items/${itemId}`);
        if (!res.ok) {
          setError("Could not load item");
          setLoading(false);
          return;
        }
        const data = (await res.json()) as {
          item: {
            name: string;
            sku: string | null;
            categoryId: string | null;
            inventoryUnitId: string | null;
            unit: string;
            purchaseRate: number;
            salesRate: number;
            reorderLevel: number;
            description: string | null;
            isActive: boolean;
            itemType?: "GOODS" | "SERVICE";
            gstTaxPreference: GstPreference;
            gstApplicable: boolean;
            gstRate: number;
            hsnCode: string | null;
            gstTaxMode: GstMode;
            reverseCharge: boolean;
            itcEligible: boolean;
          };
        };
        const i = data.item;
        setName(i.name);
        setSku(i.sku ?? "");
        setCategoryId(i.categoryId ?? "");
        setInventoryUnitId(i.inventoryUnitId ?? "");
        setUnitFallback(i.unit);
        setPurchaseRate(String(i.purchaseRate));
        setSalesRate(String(i.salesRate));
        setReorderLevel(String(i.reorderLevel));
        setDescription(i.description ?? "");
        setIsActive(i.isActive);
        if (i.itemType) setItemType(i.itemType);
        setGstTaxPreference(i.gstTaxPreference);
        setGstApplicable(i.gstApplicable);
        setGstRate(String(i.gstRate));
        setHsnCode(i.hsnCode ?? "");
        setGstTaxMode(i.gstTaxMode);
        setReverseCharge(i.reverseCharge);
        setItcEligible(i.itcEligible);
        setLoading(false);
      }
    })();
  }, [itemId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const pr = Number.parseFloat(purchaseRate);
    const sr = Number.parseFloat(salesRate);
    const rl = Number.parseFloat(reorderLevel) || 0;
    const os = Number.parseFloat(openingStock) || 0;
    const gr = Number.parseFloat(gstRate) || 0;

    if (!name.trim()) {
      setError("Name is required.");
      return;
    }

    const gstPayload = {
      gstTaxPreference,
      gstApplicable,
      gstRate: gr,
      hsnCode: hsnCode.trim() || null,
      gstTaxMode,
      reverseCharge,
      itcEligible,
    };

    try {
      if (isEdit && itemId) {
        const res = await fetch(`/api/inventory/items/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            sku: sku.trim() || null,
            categoryId: categoryId || null,
            inventoryUnitId: inventoryUnitId || null,
            unit: unitFallback.trim() || "unit",
            purchaseRate: pr,
            salesRate: sr,
            reorderLevel: rl,
            description: description.trim() || null,
            isActive,
            itemType,
            ...gstPayload,
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Save failed");
          return;
        }
      } else {
        const res = await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemType,
            name: name.trim(),
            sku: sku.trim() || null,
            autoSku,
            unit: inventoryUnitId ? "unit" : unitFallback.trim() || "Nos",
            categoryId: categoryId || null,
            inventoryUnitId: inventoryUnitId || null,
            salesDescription: null,
            purchaseDescription: null,
            description: description.trim() || null,
            salesRate: sr,
            purchaseRate: pr,
            sellable: true,
            purchasable: true,
            reorderLevel: rl,
            isActive,
            openingStock: os,
            ...gstPayload,
          }),
        });
        const data = (await res.json()) as { error?: string; issues?: unknown };
        if (!res.ok) {
          setError(data.error ?? "Could not create item");
          return;
        }
      }

      router.push("/dashboard/inventory/items");
      router.refresh();
    } catch {
      setError("Network error.");
    }
  }

  const taxTypeLabel =
    gstTaxMode === "INTER"
      ? "Inter-state → IGST on every transaction"
      : gstTaxMode === "INTRA"
        ? "Intra-state → CGST + SGST on every transaction"
        : companyGstin
          ? "Auto: state codes from company vs customer/vendor GSTIN on each document"
          : "Auto: add your company GSTIN under Settings for accurate place of supply";

  if (loading) {
    return <p className="py-12 text-center text-slate-500">Loading…</p>;
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mt-8 max-w-2xl space-y-6">
      {error ? (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">{error}</div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Basics</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>Item name</label>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className={label}>Classification</label>
            <select className={input} value={itemType} onChange={(e) => setItemType(e.target.value as "GOODS" | "SERVICE")}>
              <option value="GOODS">Goods</option>
              <option value="SERVICE">Services</option>
            </select>
          </div>
          <div>
            <label className={label}>SKU</label>
            <input className={input} value={sku} onChange={(e) => setSku(e.target.value)} disabled={autoSku && !isEdit} />
            {!isEdit ? (
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <input type="checkbox" checked={autoSku} onChange={(e) => setAutoSku(e.target.checked)} />
                Auto-generate SKU
              </label>
            ) : null}
          </div>
          <div>
            <label className={label}>Status</label>
            <select
              className={input}
              value={isActive ? "active" : "inactive"}
              onChange={(e) => setIsActive(e.target.value === "active")}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Category</label>
            <select
              className={input}
              value={categoryId}
              onChange={(e) => {
                const id = e.target.value;
                setCategoryId(id);
                const catName = categories.find((c) => c.id === id)?.name ?? "";
                const sug = suggestGstRateForCategoryName(catName);
                if (sug != null && gstTaxPreference === "TAXABLE") {
                  setGstRate(String(sug));
                }
              }}
            >
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">Some categories suggest a default GST slab when preference is Taxable.</p>
          </div>
          <div>
            <label className={label}>Unit (catalog)</label>
            <select className={input} value={inventoryUnitId} onChange={(e) => setInventoryUnitId(e.target.value)}>
              <option value="">Custom below</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.abbreviation ? ` (${u.abbreviation})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Custom unit label</label>
            <input
              className={input}
              value={unitFallback}
              onChange={(e) => setUnitFallback(e.target.value)}
              placeholder="Nos, Kg…"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setGstOpen((o) => !o)}
          className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-900 dark:text-white"
          aria-expanded={gstOpen}
        >
          GST Details (India)
          <span className="text-slate-400">{gstOpen ? "▼" : "▶"}</span>
        </button>
        {gstOpen ? (
          <div className="mt-4 space-y-4 border-t border-slate-100 pt-4 dark:border-slate-800">
            <fieldset>
              <legend className={label}>Tax preference</legend>
              <div className="mt-2 flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-300">
                {(
                  [
                    ["TAXABLE", "Taxable"],
                    ["NON_TAXABLE", "Non-taxable"],
                    ["EXEMPT", "Exempt"],
                    ["NIL_RATED", "Nil rated"],
                  ] as const
                ).map(([v, lab]) => (
                  <label key={v} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="gstPref"
                      checked={gstTaxPreference === v}
                      onChange={() => {
                        setGstTaxPreference(v);
                        if (v !== "TAXABLE") {
                          setGstRate("0");
                          setGstApplicable(false);
                        } else {
                          setGstApplicable(true);
                          if (gstRate === "0") setGstRate("18");
                        }
                      }}
                    />
                    {lab}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label className={label}>GST rate (%)</label>
              <select
                className={input}
                value={gstRate}
                onChange={(e) => setGstRate(e.target.value)}
                disabled={gstTaxPreference !== "TAXABLE"}
              >
                {GST_RATE_OPTIONS.map((r) => (
                  <option key={r} value={String(r)}>
                    {r}%
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={label}>Tax type (for invoices / bills)</label>
              <select className={input} value={gstTaxMode} onChange={(e) => setGstTaxMode(e.target.value as GstMode)}>
                <option value="AUTO">Auto (intra → CGST+SGST, inter → IGST)</option>
                <option value="INTRA">Force intra-state (CGST + SGST)</option>
                <option value="INTER">Force inter-state (IGST)</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Example with company vs party GSTIN: <span className="font-medium">{taxTypeLabel}</span>
                {!companyGstin ? " — set company GSTIN under Settings → Company for accurate auto mode." : null}
              </p>
            </div>

            <div>
              <label className={`${label} inline-flex items-center gap-1`}>
                HSN / SAC code
                <span
                  className="cursor-help text-slate-400"
                  title="Harmonized System of Nomenclature (goods) or Services Accounting Code. Required for GST returns when the item is taxable."
                >
                  ⓘ
                </span>
              </label>
              <input
                className={input}
                value={hsnCode}
                onChange={(e) => setHsnCode(e.target.value)}
                maxLength={32}
                list="gst-hsn-hints"
                placeholder="e.g. 998314"
                disabled={gstTaxPreference !== "TAXABLE"}
              />
              <datalist id="gst-hsn-hints">
                {COMMON_HSN_SAC_HINTS.map((h) => (
                  <option key={h} value={h} />
                ))}
              </datalist>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={reverseCharge} onChange={(e) => setReverseCharge(e.target.checked)} />
              Reverse charge applicable
            </label>

            <fieldset>
              <legend className={label}>ITC eligibility (purchases)</legend>
              <div className="mt-2 flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" name="itc" checked={itcEligible} onChange={() => setItcEligible(true)} />
                  Eligible
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="itc" checked={!itcEligible} onChange={() => setItcEligible(false)} />
                  Ineligible
                </label>
              </div>
            </fieldset>
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">Expand to configure HSN, GST rate, place-of-supply mode, and ITC flags.</p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Pricing & stock</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Purchase price</label>
            <input className={input} type="number" step="0.01" min="0" value={purchaseRate} onChange={(e) => setPurchaseRate(e.target.value)} required />
          </div>
          <div>
            <label className={label}>Selling price</label>
            <input className={input} type="number" step="0.01" min="0" value={salesRate} onChange={(e) => setSalesRate(e.target.value)} required />
          </div>
          {!isEdit ? (
            <div>
              <label className={label}>Opening stock</label>
              <input className={input} type="number" step="0.0001" min="0" value={openingStock} onChange={(e) => setOpeningStock(e.target.value)} />
              <p className="mt-1 text-xs text-slate-500">Posted to your default warehouse.</p>
            </div>
          ) : null}
          <div>
            <label className={label}>Reorder level</label>
            <input className={input} type="number" step="0.0001" min="0" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Description</label>
            <textarea
              className={`${input} min-h-[100px]`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className="rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600"
        >
          {isEdit ? "Save changes" : "Create item"}
        </button>
        <Link
          href="/dashboard/inventory/items"
          className="rounded-xl border border-slate-200 px-6 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

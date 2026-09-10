import type { InvoiceSummaryView } from "@/lib/sales/invoice-document-summary";

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function InvoiceSummaryReadOnly({ view }: Readonly<{ view: InvoiceSummaryView }>) {
  const hasDiscount = view.discountPercent > 0 && view.discountAmount > 0;
  const hasWh = view.withholdingType !== "NONE" && view.withholdingAmount > 0;
  const hasAdj = Math.abs(view.adjustmentAmount) > 0.0005;
  const simple = !hasDiscount && !hasWh && !hasAdj && Math.abs(view.payableTotal - view.lineGrand) < 0.005;
  const showLineGrossFirst = !hasDiscount && (hasWh || hasAdj);

  if (simple) {
    return (
      <div className="mt-6 rounded-xl border border-slate-200 bg-gradient-to-b from-teal-50/30 to-transparent px-4 py-3 dark:border-slate-700 dark:from-teal-950/20">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-semibold text-slate-800 dark:text-slate-200">Total ( ₹ )</span>
          <span className="text-base font-bold tabular-nums text-teal-800 dark:text-teal-300">{fmt(view.payableTotal)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-gradient-to-b from-teal-50/40 via-slate-50/50 to-white px-4 py-4 dark:border-slate-700 dark:from-teal-950/20 dark:via-slate-900/80 dark:to-slate-900 sm:px-5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-300">Summary & adjustments</h3>
      <dl className="mt-3 max-w-xl space-y-2.5 sm:ml-auto">
        <div className="flex justify-between gap-4 border-b border-slate-200/90 pb-2 text-sm dark:border-slate-600/90">
          <dt className="font-semibold text-slate-800 dark:text-slate-200">
            {showLineGrossFirst ? "Subtotal (ex tax + tax)" : "Sub total (ex tax)"}
          </dt>
          <dd className="tabular-nums font-semibold text-slate-900 dark:text-white">
            {showLineGrossFirst ? fmt(view.lineGrand) : fmt(view.lineNetSum)}
          </dd>
        </div>
        {showLineGrossFirst ? (
          <div className="flex justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
            <dt>Incl. ex tax</dt>
            <dd className="tabular-nums">
              {fmt(view.lineNetSum)} + tax {fmt(view.lineTaxSum)}
            </dd>
          </div>
        ) : null}
        {hasDiscount ? (
          <>
            <div className="flex justify-between gap-4 text-sm">
              <dt className="text-slate-600 dark:text-slate-400">Discount ({view.discountPercent}%)</dt>
              <dd className="tabular-nums text-slate-900 dark:text-white">{fmt(view.discountAmount)}</dd>
            </div>
            <div className="flex justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
              <dt>Value after discount + tax</dt>
              <dd className="tabular-nums">
                {fmt(view.netAfterDiscount)} + {fmt(view.taxAfterDiscount)} = {fmt(view.preWithholding)}
              </dd>
            </div>
          </>
        ) : null}
        {hasWh ? (
          <div className="flex justify-between gap-4 text-sm">
            <dt className="text-slate-600 dark:text-slate-400">
              {view.withholdingType} ({view.withholdingPercent}%)
            </dt>
            <dd
              className={`tabular-nums ${view.withholdingType === "TDS" ? "text-amber-700 dark:text-amber-400" : "text-teal-700 dark:text-teal-400"}`}
            >
              {view.withholdingType === "TDS" ? "− " : "+ "}
              {fmt(view.withholdingAmount)}
            </dd>
          </div>
        ) : null}
        {hasAdj ? (
          <div className="flex justify-between gap-4 text-sm">
            <dt className="text-slate-600 dark:text-slate-400">{view.adjustmentLabel}</dt>
            <dd className="tabular-nums text-slate-900 dark:text-white">{fmt(view.adjustmentAmount)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 dark:border-slate-600">
          <dt className="text-base font-bold text-slate-900 dark:text-white">Total ( ₹ )</dt>
          <dd className="text-base font-bold tabular-nums text-teal-800 dark:text-teal-300">{fmt(view.payableTotal)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
        Line subtotal + tax = {fmt(view.lineGrand)}. Amount due reflects discounts, withholding, and adjustments.
      </p>
    </div>
  );
}

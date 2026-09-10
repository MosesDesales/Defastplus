"use client";

import type { DocumentTemplateConfig } from "@/lib/document-template-types";

function fmtMoney(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export type TemplatePreviewCompany = {
  companyName: string;
  gstin: string | null;
  logoUrl: string | null;
  addressLine: string | null;
};

const SAMPLE_LINES = [
  { item: "Professional services", desc: "Consulting — May", qty: 1, rate: 10000, tax: 18, amount: 11800, cgst: 900, sgst: 900, igst: 0 },
  { item: "Software subscription", desc: "Annual seat", qty: 2, rate: 2500, tax: 18, amount: 5900, cgst: 450, sgst: 450, igst: 0 },
];

export function DocumentTemplatePreview({
  docLabel,
  docNumber,
  issueDate,
  dueDate,
  company,
  config,
}: Readonly<{
  docLabel: string;
  docNumber: string;
  issueDate: string;
  dueDate?: string | null;
  company: TemplatePreviewCompany;
  config: DocumentTemplateConfig;
}>) {
  const c = config.colors;
  const cols = config.columns;
  const showCol = (k: (typeof cols)[number]) => cols.includes(k);
  const alignClass =
    config.header.alignment === "center" ? "text-center" : config.header.alignment === "right" ? "text-right" : "text-left";

  return (
    <div
      className="overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-slate-950"
      style={{ borderColor: c.tableBorder }}
    >
      <div className="h-1 w-full" style={{ backgroundColor: c.primary }} />
      <div className="p-4 sm:p-5" style={{ fontSize: `${config.typography.bodyFontSizePt}px` }}>
        <div className={`flex flex-wrap items-start justify-between gap-4 ${alignClass}`}>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start gap-3">
              {config.header.showLogo && company.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={company.logoUrl} alt="" className="h-10 max-w-[120px] object-contain" />
              ) : null}
              <div className="min-w-0">
                {config.documentInfo.showNumber !== false ? (
                  <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: c.primary }}>
                    {docLabel}
                  </p>
                ) : null}
                {config.documentInfo.showNumber !== false ? (
                  <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{docNumber}</p>
                ) : null}
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {config.documentInfo.showIssueDate !== false ? <span>Issued {issueDate}</span> : null}
                  {config.documentInfo.showIssueDate !== false && config.documentInfo.showDueDate !== false && dueDate ? (
                    <span> · </span>
                  ) : null}
                  {config.documentInfo.showDueDate !== false && dueDate ? <span>Due {dueDate}</span> : null}
                </div>
              </div>
            </div>
          </div>
          <div className={`min-w-[10rem] max-w-full text-sm ${config.header.alignment === "right" ? "text-right" : "text-left"}`}>
            {config.header.showCompanyName !== false ? (
              <p className="font-semibold text-slate-900 dark:text-white">{company.companyName || "Company"}</p>
            ) : null}
            {config.header.showGstin !== false && company.gstin ? (
              <p className="mt-0.5 text-xs text-slate-500">GSTIN: {company.gstin}</p>
            ) : null}
            {config.header.showAddress !== false && company.addressLine ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{company.addressLine}</p>
            ) : null}
          </div>
        </div>

        {config.party.show !== false ? (
          <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{config.party.label}</p>
            <p className="mt-1 font-medium text-slate-900 dark:text-white">Acme Retail Pvt Ltd</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">GSTIN: 27AAAAA0000A1Z5 · billing@acme.test</p>
          </div>
        ) : null}

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-left text-xs">
            <thead>
              <tr style={{ backgroundColor: c.tableHeaderBg, color: c.primary }}>
                {showCol("item") || showCol("description") ? (
                  <th className="border px-2 py-2 font-semibold" style={{ borderColor: c.tableBorder }}>
                    Item
                  </th>
                ) : null}
                {showCol("qty") ? (
                  <th className="border px-2 py-2 text-right font-semibold" style={{ borderColor: c.tableBorder }}>
                    Qty
                  </th>
                ) : null}
                {showCol("rate") ? (
                  <th className="border px-2 py-2 text-right font-semibold" style={{ borderColor: c.tableBorder }}>
                    Rate
                  </th>
                ) : null}
                {showCol("tax") ? (
                  <th className="border px-2 py-2 text-right font-semibold" style={{ borderColor: c.tableBorder }}>
                    Tax %
                  </th>
                ) : null}
                {showCol("amount") ? (
                  <th className="border px-2 py-2 text-right font-semibold" style={{ borderColor: c.tableBorder }}>
                    Amount
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {SAMPLE_LINES.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-slate-50/80 dark:bg-slate-900/40" : ""}>
                  {showCol("item") || showCol("description") ? (
                    <td className="border px-2 py-2 text-slate-800 dark:text-slate-200" style={{ borderColor: c.tableBorder }}>
                      {showCol("item") ? <span className="font-medium">{row.item}</span> : null}
                      {showCol("item") && showCol("description") ? <br /> : null}
                      {showCol("description") ? <span className="text-slate-500 dark:text-slate-400">{row.desc}</span> : null}
                    </td>
                  ) : null}
                  {showCol("qty") ? (
                    <td className="border px-2 py-2 text-right tabular-nums" style={{ borderColor: c.tableBorder }}>
                      {row.qty}
                    </td>
                  ) : null}
                  {showCol("rate") ? (
                    <td className="border px-2 py-2 text-right tabular-nums" style={{ borderColor: c.tableBorder }}>
                      {fmtMoney(row.rate)}
                    </td>
                  ) : null}
                  {showCol("tax") ? (
                    <td className="border px-2 py-2 text-right tabular-nums" style={{ borderColor: c.tableBorder }}>
                      {row.tax}
                    </td>
                  ) : null}
                  {showCol("amount") ? (
                    <td className="border px-2 py-2 text-right font-medium tabular-nums" style={{ borderColor: c.tableBorder }}>
                      {fmtMoney(row.amount)}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-[220px] space-y-1 text-xs">
            {config.summary.showSubtotal !== false ? (
              <div className="flex justify-between gap-4 text-slate-600 dark:text-slate-400">
                <span>Subtotal (ex tax)</span>
                <span className="tabular-nums">{fmtMoney(25000)}</span>
              </div>
            ) : null}
            {config.summary.showGstSplit !== false ? (
              <>
                <div className="flex justify-between gap-4 text-slate-600 dark:text-slate-400">
                  <span>CGST</span>
                  <span className="tabular-nums">{fmtMoney(2250)}</span>
                </div>
                <div className="flex justify-between gap-4 text-slate-600 dark:text-slate-400">
                  <span>SGST</span>
                  <span className="tabular-nums">{fmtMoney(2250)}</span>
                </div>
                <div className="flex justify-between gap-4 text-slate-600 dark:text-slate-400">
                  <span>IGST</span>
                  <span className="tabular-nums">{fmtMoney(0)}</span>
                </div>
              </>
            ) : null}
            {config.summary.showTotal !== false ? (
              <div
                className="flex justify-between gap-4 border-t border-slate-200 pt-2 text-sm font-semibold dark:border-slate-700"
                style={{ color: c.primary }}
              >
                <span>Total</span>
                <span className="tabular-nums">{fmtMoney(29500)}</span>
              </div>
            ) : null}
          </div>
        </div>

        {config.customFields?.length ? (
          <div className="mt-4 grid gap-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
            {config.customFields.map((f) => (
              <div key={f.id} className="flex justify-between gap-2">
                <span className="text-slate-500">{f.label}</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{f.value || "—"}</span>
              </div>
            ))}
          </div>
        ) : null}

        {(config.footer.showNotes !== false && config.footer.notes?.trim()) ||
        (config.footer.showTerms !== false && config.footer.terms?.trim()) ? (
          <div className="mt-5 border-t border-slate-100 pt-4 text-xs dark:border-slate-800">
            {config.footer.showNotes !== false && config.footer.notes?.trim() ? (
              <div className="mb-3">
                <p className="font-semibold text-slate-700 dark:text-slate-300">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-600 dark:text-slate-400">{config.footer.notes}</p>
              </div>
            ) : null}
            {config.footer.showTerms !== false && config.footer.terms?.trim() ? (
              <div>
                <p className="font-semibold text-slate-700 dark:text-slate-300">Terms &amp; conditions</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-600 dark:text-slate-400">{config.footer.terms}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {config.footer.showSignature !== false ? (
          <div className="mt-8 flex justify-end">
            <div className="text-right text-xs text-slate-500">
              <div className="h-10 border-b border-slate-300 dark:border-slate-600" />
              <p className="mt-1">{config.footer.signatureLabel || "Authorized signatory"}</p>
            </div>
          </div>
        ) : null}

        <div className="mt-6 h-1 w-full rounded-full" style={{ backgroundColor: c.primary }} />
        <p className="mt-2 text-center text-[10px] text-slate-500">{company.companyName}</p>
      </div>
    </div>
  );
}

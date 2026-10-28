import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { PrintButton } from "@/components/documents/PrintButton";
import type { BusinessDocument, DocLine } from "@/lib/documents/business-document";
import { loadLogo } from "@/lib/pdf/pdf-kit";

/**
 * On-screen version of the PDF layout (lib/pdf/business-document-pdf.ts). Both render the
 * same BusinessDocument model, so the preview always matches the downloaded PDF.
 */

const money = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 3 });

function Label({ children }: { children: ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--doc-primary)]">{children}</p>;
}

function KeyValues({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="mt-2 space-y-1.5 text-[13px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-4">
          <dt className="shrink-0 text-slate-500">{k}</dt>
          <dd className="text-right font-semibold text-slate-900 [overflow-wrap:anywhere]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

type ColKey = "hsn" | "qty" | "rate" | "taxable" | "cgst" | "sgst" | "igst" | "gst";

function columnsFor(d: BusinessDocument): { key: ColKey; label: string }[] {
  const c = d.columns;
  const out: { key: ColKey; label: string }[] = [];
  if (c.hsn) out.push({ key: "hsn", label: "HSN/SAC" });
  if (c.qty) out.push({ key: "qty", label: "Qty" });
  if (c.rate) out.push({ key: "rate", label: "Rate" });
  if (c.taxable && c.tax) out.push({ key: "taxable", label: "Taxable Value" });
  if (c.tax) {
    if (d.taxMode === "split") out.push({ key: "cgst", label: "CGST" }, { key: "sgst", label: "SGST" });
    else if (d.taxMode === "igst") out.push({ key: "igst", label: "IGST" });
    else if (d.taxMode === "mixed") out.push({ key: "gst", label: d.kind === "expense" ? "Tax" : "GST" });
  }
  return out;
}

function Cell({ main, sub, bold }: { main: string; sub?: string | null; bold?: boolean }) {
  return (
    <>
      <span className={bold ? "font-semibold" : undefined}>{main}</span>
      {sub ? <span className="block text-[10px] text-slate-500">{sub}</span> : null}
    </>
  );
}

function lineCell(key: ColKey, l: DocLine) {
  const half = Math.round((l.taxPercent / 2) * 100) / 100;
  switch (key) {
    case "hsn":
      return <Cell main={l.hsn || "—"} />;
    case "qty":
      return <Cell main={l.qty == null ? "—" : qty(l.qty)} sub={l.unit} />;
    case "rate":
      return <Cell main={l.rate == null ? "—" : money(l.rate)} />;
    case "taxable":
      return <Cell main={money(l.taxable)} />;
    case "cgst":
      return <Cell main={money(l.cgst)} sub={`@ ${half}%`} />;
    case "sgst":
      return <Cell main={money(l.sgst)} sub={`@ ${half}%`} />;
    case "igst":
      return <Cell main={money(l.igst)} sub={`@ ${l.taxPercent}%`} />;
    case "gst":
      return <Cell main={money(l.tax)} sub={l.taxPercent ? `@ ${l.taxPercent}%` : null} />;
  }
}

export function BusinessDocumentView({ doc: d, logoSrc }: { doc: BusinessDocument; logoSrc?: string | null }) {
  const sym = d.currency === "INR" ? "₹" : d.currency;
  const cols = columnsFor(d);
  const style = {
    "--doc-primary": d.theme.primary,
    "--doc-soft": d.theme.soft,
    "--doc-head": d.theme.tableHead,
    "--doc-border": d.theme.tableBorder,
  } as CSSProperties;

  return (
    <article
      style={style}
      className="relative mx-auto w-full max-w-[860px] overflow-hidden rounded-xl bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 print:max-w-none print:rounded-none print:shadow-none print:ring-0"
    >
      <div className="h-1.5 bg-[var(--doc-primary)]" />
      {d.watermark ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <span className="-rotate-[32deg] select-none text-[120px] font-black tracking-widest text-[var(--doc-primary)] opacity-[0.06] sm:text-[160px]">
            {d.watermark}
          </span>
        </div>
      ) : null}

      <div className="relative px-5 py-7 sm:px-10 sm:py-9">
        {/* Header */}
        <header className="flex flex-col gap-6 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            {d.showLogo && (logoSrc ?? d.company.logoUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={(logoSrc ?? d.company.logoUrl)!} alt={`${d.company.name} logo`} className="h-16 w-auto max-w-[140px] shrink-0 object-contain" />
            ) : null}
            <div className="min-w-0">
              <h2 className="text-xl font-bold leading-tight sm:text-2xl">{d.company.name}</h2>
              {d.company.legalName ? <p className="text-xs text-slate-500">{d.company.legalName}</p> : null}
              <div className="mt-1 space-y-0.5 text-[13px] text-slate-500">
                {d.company.addressLines.map((l) => (
                  <p key={l}>{l}</p>
                ))}
              </div>
              {d.company.gstin || d.company.pan ? (
                <p className="mt-1 text-[13px] font-semibold">
                  {d.company.gstin ? <span className="mr-4">GSTIN {d.company.gstin}</span> : null}
                  {d.company.pan ? <span>PAN {d.company.pan}</span> : null}
                </p>
              ) : null}
              {d.company.contact ? <p className="mt-0.5 text-xs text-slate-500">{d.company.contact}</p> : null}
            </div>
          </div>
          <div className="shrink-0 sm:text-right">
            <h1 className="text-2xl font-extrabold tracking-wide text-[var(--doc-primary)] sm:text-3xl">{d.title}</h1>
            {d.copyLabel ? <p className="text-[11px] font-medium tracking-wide text-slate-500">{d.copyLabel}</p> : null}
            <p className="mt-2 text-sm font-semibold"># {d.number}</p>
            {d.headline ? (
              <div className="mt-2">
                <p className="text-xs text-slate-500">{d.headline.label}</p>
                <p className="text-2xl font-bold tabular-nums">
                  {sym} {money(d.headline.value)}
                </p>
              </div>
            ) : null}
          </div>
        </header>

        {/* Party + details */}
        <section className={`mt-6 grid gap-4 ${d.party ? "md:grid-cols-2" : ""}`}>
          {d.party ? (
            <div className="rounded-lg border border-[var(--doc-border)] bg-[var(--doc-soft)] p-4">
              <Label>{d.party.label}</Label>
              <p className="mt-2 text-base font-bold">{d.party.name}</p>
              <div className="mt-1 space-y-0.5 text-[13px]">
                {d.party.lines.map((l) => (
                  <p
                    key={l.text}
                    className={l.tone === "strong" ? "font-semibold" : l.tone === "muted" ? "text-xs text-slate-500" : undefined}
                  >
                    {l.text}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
          <div className="rounded-lg border border-slate-200 p-4">
            <Label>{d.detailsTitle}</Label>
            <KeyValues rows={d.details} />
          </div>
        </section>

        {/* Lines */}
        <section className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-[var(--doc-head)] text-left text-[10px] font-semibold uppercase tracking-wider text-slate-700">
                <th className="w-8 px-2 py-2.5 text-center">#</th>
                <th className="px-2 py-2.5">{d.kind === "expense" ? "Expense Account" : "Item & Description"}</th>
                {cols.map((c) => (
                  <th key={c.key} className={`px-2 py-2.5 ${c.key === "hsn" ? "" : "text-right"}`}>
                    {c.label}
                  </th>
                ))}
                <th className="px-2 py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {d.lines.map((l, i) => (
                <tr key={i} className="border-b border-slate-100 align-top even:bg-slate-50/70">
                  <td className="px-2 py-2.5 text-center tabular-nums">{i + 1}</td>
                  <td className="px-2 py-2.5 font-medium [overflow-wrap:anywhere]">{l.description}</td>
                  {cols.map((c) => (
                    <td key={c.key} className={`px-2 py-2.5 tabular-nums ${c.key === "hsn" ? "" : "text-right"}`}>
                      {lineCell(c.key, l)}
                    </td>
                  ))}
                  <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{money(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="h-px bg-[var(--doc-border)]" />
        </section>

        {/* Summary */}
        <section className="mt-6 grid gap-6 md:grid-cols-[1fr_280px]">
          <div className="min-w-0 space-y-5">
            {d.amountInWords ? (
              <div>
                <Label>Amount in words</Label>
                <p className="mt-1 text-sm font-medium">{d.amountInWords}</p>
              </div>
            ) : null}
            {d.gstSummary ? (
              <div className="overflow-x-auto">
                <Label>GST Summary</Label>
                <table className="mt-2 w-full min-w-[360px] text-xs tabular-nums">
                  <thead>
                    <tr className="bg-[var(--doc-soft)] text-[10px] font-semibold text-slate-600">
                      <th className="px-2 py-1.5 text-left">GST Rate</th>
                      <th className="px-2 py-1.5 text-right">Taxable</th>
                      {d.taxMode === "split" || d.taxMode === "mixed" ? (
                        <>
                          <th className="px-2 py-1.5 text-right">CGST</th>
                          <th className="px-2 py-1.5 text-right">SGST</th>
                        </>
                      ) : null}
                      {d.taxMode === "igst" || d.taxMode === "mixed" ? <th className="px-2 py-1.5 text-right">IGST</th> : null}
                      <th className="px-2 py-1.5 text-right">Total Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.gstSummary.map((g) => (
                      <tr key={g.rate} className="border-b border-slate-100">
                        <td className="px-2 py-1.5">{g.rate}%</td>
                        <td className="px-2 py-1.5 text-right">{money(g.taxable)}</td>
                        {d.taxMode === "split" || d.taxMode === "mixed" ? (
                          <>
                            <td className="px-2 py-1.5 text-right">{money(g.cgst)}</td>
                            <td className="px-2 py-1.5 text-right">{money(g.sgst)}</td>
                          </>
                        ) : null}
                        {d.taxMode === "igst" || d.taxMode === "mixed" ? <td className="px-2 py-1.5 text-right">{money(g.igst)}</td> : null}
                        <td className="px-2 py-1.5 text-right">{money(g.tax)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {d.gstSummaryNote ? <p className="mt-1 text-[11px] text-slate-500">{d.gstSummaryNote}</p> : null}
              </div>
            ) : null}
          </div>
          <div className="self-start overflow-hidden rounded-lg border border-slate-200">
            <dl className="space-y-1.5 p-4 text-[13px]">
              {d.totals.map((r) => (
                <div key={r.label} className="flex justify-between gap-4">
                  <dt className="text-slate-500">{r.label}</dt>
                  <dd className="font-medium tabular-nums">
                    {r.sign === "minus" ? "− " : r.sign === "plus" ? "+ " : ""}
                    {money(r.value)}
                  </dd>
                </div>
              ))}
            </dl>
            {d.total ? (
              <div className="flex items-center justify-between gap-4 bg-[var(--doc-primary)] px-4 py-3 text-white">
                <span className="text-sm font-semibold">{d.total.label}</span>
                <span className="text-lg font-bold tabular-nums">
                  {sym} {money(d.total.value)}
                </span>
              </div>
            ) : null}
          </div>
        </section>

        {/* Notes */}
        {d.notes.length ? (
          <section className="mt-6 space-y-4">
            {d.notes.map((n) => (
              <div key={n.title}>
                <Label>{n.title}</Label>
                <p className="mt-1 whitespace-pre-line text-[13px]">{n.body}</p>
              </div>
            ))}
          </section>
        ) : null}

        {/* Bank + signature */}
        {d.bank || d.signature ? (
          <section className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            {d.bank ? (
              <div className="w-full rounded-lg border border-[var(--doc-border)] bg-[var(--doc-soft)] p-4 sm:max-w-sm">
                <Label>Bank Details</Label>
                <KeyValues
                  rows={
                    [
                      ["Account Name", d.bank.accountName],
                      ["Bank", d.bank.bankName],
                      ["Account No.", d.bank.accountNumber],
                      ["IFSC", d.bank.ifsc],
                      ["Branch", d.bank.branch],
                      ["UPI", d.bank.upi],
                    ].filter(([, v]) => v) as [string, string][]
                  }
                />
              </div>
            ) : (
              <span />
            )}
            {d.signature ? (
              <div className="text-right sm:w-56">
                <p className="text-[13px] font-semibold">{d.signature.forLabel}</p>
                <div className="mt-12 border-t border-slate-800" />
                <p className="mt-1 text-xs text-slate-500">{d.signature.label}</p>
              </div>
            ) : null}
          </section>
        ) : null}

        <footer className="mt-10 flex flex-col gap-1 border-t border-slate-200 pt-3 text-[11px] text-slate-500 sm:flex-row sm:justify-between">
          <span>{[d.company.name, d.company.gstin ? `GSTIN ${d.company.gstin}` : null].filter(Boolean).join(" · ")}</span>
          <span>{d.footerNote}</span>
        </footer>
      </div>
      <div className="h-1.5 bg-[var(--doc-primary)]" />
    </article>
  );
}

/** Page shell for every document preview: toolbar (back, download PDF, print) + the document. */
export async function DocumentPreviewPage({ doc, backHref, backLabel, pdfHref }: { doc: BusinessDocument; backHref: string; backLabel: string; pdfHref: string }) {
  // Same trimmed logo as the PDF, so padded logo files still fill the header.
  const logo = doc.showLogo ? await loadLogo(doc.company.logoUrl) : null;
  const logoSrc = logo ? `data:image/png;base64,${logo.buf.toString("base64")}` : null;
  return (
    <div className="min-h-screen bg-slate-100 px-3 py-6 print:bg-white print:p-0 sm:px-4 sm:py-10">
      <div className="mx-auto mb-4 flex max-w-[860px] flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden /> {backLabel}
        </Link>
        <div className="flex items-center gap-3">
          <a
            href={pdfHref}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700"
          >
            <Download className="h-4 w-4" aria-hidden /> Download PDF
          </a>
          <PrintButton />
        </div>
      </div>
      <BusinessDocumentView doc={doc} logoSrc={logoSrc} />
    </div>
  );
}

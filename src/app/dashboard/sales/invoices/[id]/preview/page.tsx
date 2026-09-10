import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/documents/PrintButton";
import { InvoiceSummaryReadOnly } from "@/components/sales/InvoiceSummaryReadOnly";
import { loadCompanyForUser, loadInvoiceDocument } from "@/lib/documents/load-invoice-document";
import {
  documentInvoiceLineTable,
  documentLineTheadRow,
  documentTdDescInvoice,
  documentTdNumInvoice,
  documentTdNumInvoiceStrong,
  documentThDescInvoice,
  documentThNumInvoice,
} from "@/lib/documents/document-table-classes";
import { fmtMoney } from "@/lib/documents/invoice-pdf-data";
import { invoiceSummaryViewFromStored } from "@/lib/sales/invoice-document-summary";
import { getSession } from "@/lib/session";

export default async function InvoicePreviewPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const inv = await loadInvoiceDocument(session.sub, id);
  if (!inv) notFound();
  const company = await loadCompanyForUser(session.sub);

  return (
    <div className="min-h-screen bg-slate-100 px-3 py-8 text-slate-900 print:bg-white print:py-4 sm:px-4 sm:py-10">
      <div className="mx-auto max-w-6xl min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-8 shadow-sm print:max-w-none print:shadow-none sm:px-8 md:px-10">
        <div className="flex items-start justify-between gap-6 border-b border-slate-100 pb-6">
          <div>
            {company?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoUrl} alt="" className="mb-3 h-12 w-auto object-contain" />
            ) : null}
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Tax invoice</p>
            <h1 className="mt-1 text-2xl font-bold">{inv.invoiceNumber}</h1>
            <p className="mt-1 text-sm text-slate-600">
              Issued {inv.issueDate.toLocaleDateString()}
              {inv.dueDate ? ` · Due ${inv.dueDate.toLocaleDateString()}` : ""}
            </p>
          </div>
          <div className="text-right text-sm text-slate-600">
            <p className="font-semibold text-slate-900">{company?.companyName ?? "Company"}</p>
            {company?.gstin ? <p>GSTIN: {company.gstin}</p> : null}
            <p className="mt-2 max-w-[14rem] text-xs leading-snug">
              {[company?.billingStreet, company?.billingCity, company?.billingState, company?.billingZip, company?.billingCountry]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Bill to</p>
            <p className="mt-1 font-medium">{inv.customer.displayName}</p>
            {inv.customer.gstin ? <p className="text-sm">GSTIN: {inv.customer.gstin}</p> : null}
            {inv.customer.email ? <p className="text-sm">{inv.customer.email}</p> : null}
          </div>
          <div className="text-sm text-slate-600 sm:text-right">
            <p>
              <span className="font-medium text-slate-800">Currency:</span> {inv.currency}
            </p>
            <p>
              <span className="font-medium text-slate-800">Status:</span> {inv.status}
            </p>
          </div>
        </div>

        <div className="mt-8 w-full min-w-0">
          <table className={documentInvoiceLineTable}>
            <colgroup>
              <col style={{ width: "26%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "14%" }} />
            </colgroup>
            <thead>
              <tr className={documentLineTheadRow}>
                <th className={documentThDescInvoice}>Description</th>
                <th className={documentThNumInvoice}>Qty</th>
                <th className={documentThNumInvoice}>Rate</th>
                <th className={documentThNumInvoice}>Tax %</th>
                <th className={documentThNumInvoice}>CGST</th>
                <th className={documentThNumInvoice}>SGST</th>
                <th className={documentThNumInvoice}>IGST</th>
                <th className={documentThNumInvoice}>Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {inv.lines.map((l) => (
                <tr key={l.id}>
                  <td className={documentTdDescInvoice}>{l.description}</td>
                  <td className={documentTdNumInvoice}>{Number(l.quantity)}</td>
                  <td className={documentTdNumInvoice}>{fmtMoney(Number(l.rate))}</td>
                  <td className={documentTdNumInvoice}>{Number(l.taxPercent)}</td>
                  <td className={documentTdNumInvoice}>{fmtMoney(Number(l.lineCgst))}</td>
                  <td className={documentTdNumInvoice}>{fmtMoney(Number(l.lineSgst))}</td>
                  <td className={documentTdNumInvoice}>{fmtMoney(Number(l.lineIgst))}</td>
                  <td className={documentTdNumInvoiceStrong}>{fmtMoney(Number(l.lineTotal))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-700">
          <InvoiceSummaryReadOnly view={invoiceSummaryViewFromStored(inv)} />
        </div>

        <div className="mt-10 flex items-center gap-4 print:hidden">
          <Link href={`/dashboard/sales/invoices/${id}`} className="text-sm font-medium text-teal-700 hover:underline">
            ← Back to invoice
          </Link>
          <PrintButton />
        </div>
      </div>
    </div>
  );
}

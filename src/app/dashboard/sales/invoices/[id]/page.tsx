import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { InvoiceEWayBillAction } from "@/components/gst/InvoiceEWayBillAction";
import { InvoiceSummaryReadOnly } from "@/components/sales/InvoiceSummaryReadOnly";
import { prisma } from "@/lib/prisma";
import { invoiceOpenAmount, invoiceSummaryViewFromStored } from "@/lib/sales/invoice-document-summary";
import { getSession } from "@/lib/session";

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function InvoiceDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { id } = await params;
  const inv = await prisma.invoice.findFirst({
    where: { id, userId: session.sub },
    include: {
      customer: true,
      lines: { orderBy: { sortOrder: "asc" } },
      allocations: { include: { payment: { select: { paymentNumber: true, paymentDate: true, mode: true } } } },
      issuanceJournal: { include: { lines: { include: { account: true } } } },
    },
  });

  if (!inv) {
    notFound();
  }

  const paid = inv.allocations.reduce((s, a) => s + Number(a.amount), 0);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/dashboard/sales/invoices" className="text-sm font-medium text-teal-600 hover:underline dark:text-teal-400">
        ← Invoices
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-slate-900 dark:text-white">{inv.invoiceNumber}</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        {inv.customer.displayName} · {inv.status}
      </p>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <InvoiceSummaryReadOnly view={invoiceSummaryViewFromStored(inv)} />
        <dl className="mt-6 grid gap-3 border-t border-slate-200 pt-6 text-sm dark:border-slate-700">
          <div className="flex justify-between">
            <dt className="text-slate-500">Paid</dt>
            <dd className="tabular-nums">{fmt(paid)}</dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt>Balance due</dt>
            <dd className="tabular-nums">{fmt(invoiceOpenAmount(inv) - paid)}</dd>
          </div>
        </dl>
      </div>

      {inv.status !== "VOID" && inv.status !== "DRAFT" ? (
        <InvoiceEWayBillAction invoiceId={inv.id} invoiceNumber={inv.invoiceNumber} />
      ) : null}

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-slate-500">Lines</h2>
      <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">Qty</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">Rate</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">Tax %</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">Line total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {inv.lines.map((l) => (
              <tr key={l.id}>
                <td className="px-3 py-2 align-top">{l.description}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{Number(l.quantity)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{fmt(Number(l.rate))}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{Number(l.taxPercent)}</td>
                <td className="px-3 py-2 text-right font-medium whitespace-nowrap tabular-nums">{fmt(Number(l.lineTotal))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {inv.allocations.length > 0 ? (
        <>
          <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-slate-500">Payments</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {inv.allocations.map((a) => (
              <li key={a.id} className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
                {a.payment.paymentNumber} · {fmt(Number(a.amount))} · {a.payment.mode} ·{" "}
                {a.payment.paymentDate.toLocaleDateString()}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {inv.issuanceJournal ? (
        <>
          <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-slate-500">Journal (issuance)</h2>
          <ul className="mt-2 space-y-1 font-mono text-xs text-slate-700 dark:text-slate-300">
            {inv.issuanceJournal.lines.map((jl) => (
              <li key={jl.id}>
                {jl.account.code} {jl.account.name} — Dr {fmt(Number(jl.debit))} Cr {fmt(Number(jl.credit))}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-6 text-sm text-slate-500">No journal entry (draft invoice).</p>
      )}
    </div>
  );
}

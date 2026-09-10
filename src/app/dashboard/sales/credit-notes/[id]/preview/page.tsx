import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/documents/PrintButton";
import {
  documentLineTheadRowBorderB,
  documentLineTableScroll,
  documentSimpleLineTable,
  documentTdDesc,
  documentTdNum,
  documentTdNumStrong,
  documentThDesc,
  documentThNum,
} from "@/lib/documents/document-table-classes";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function CreditNotePreviewPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;

  const cn = await prisma.creditNote.findFirst({
    where: { id, userId: session.sub },
    include: { customer: true, lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!cn) notFound();

  const company = await prisma.companyProfile.findUnique({ where: { userId: session.sub } });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 print:max-w-none print:px-8">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard/sales/credit-notes" className="text-sm font-medium text-teal-600 dark:text-teal-400">
          ← Credit notes
        </Link>
        <PrintButton />
      </div>
      <div id="cn-print" className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none dark:border-slate-800 dark:bg-slate-900">
        {company?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={company.logoUrl} alt="" className="mb-6 h-12 object-contain object-left" />
        ) : null}
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Credit note</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{cn.creditNumber}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {company?.companyName ?? "Company"} · {cn.issueDate.toLocaleDateString()}
        </p>
        <div className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase text-slate-500">Bill to</p>
            <p className="font-medium text-slate-900 dark:text-white">{cn.customer.displayName}</p>
            {cn.customer.email ? <p className="text-slate-600 dark:text-slate-400">{cn.customer.email}</p> : null}
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-slate-500">Status</p>
            <p>{cn.status}</p>
            {cn.reason ? <p className="mt-1 text-slate-600 dark:text-slate-400">{cn.reason}</p> : null}
          </div>
        </div>
        <div className={documentLineTableScroll}>
          <table className={documentSimpleLineTable}>
            <thead>
              <tr className={documentLineTheadRowBorderB}>
                <th className={documentThDesc}>Description</th>
                <th className={documentThNum}>Qty</th>
                <th className={documentThNum}>Rate</th>
                <th className={documentThNum}>Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {cn.lines.map((l) => (
                <tr key={l.id}>
                  <td className={documentTdDesc}>{l.description}</td>
                  <td className={documentTdNum}>{Number(l.quantity)}</td>
                  <td className={documentTdNum}>{Number(l.rate).toFixed(2)}</td>
                  <td className={documentTdNumStrong}>{Number(l.lineTotal).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex justify-end border-t border-slate-200 pt-4 text-sm dark:border-slate-700">
          <dl className="w-64 space-y-1">
            <div className="flex justify-between">
              <dt className="text-slate-600 dark:text-slate-400">Subtotal</dt>
              <dd className="tabular-nums">{Number(cn.subTotal).toFixed(2)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600 dark:text-slate-400">Tax</dt>
              <dd className="tabular-nums">{Number(cn.taxTotal).toFixed(2)}</dd>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{Number(cn.total).toFixed(2)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

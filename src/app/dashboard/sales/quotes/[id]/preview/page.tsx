import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/documents/PrintButton";
import {
  documentLineTheadRowBorderB,
  documentLineTableScroll,
  documentSimpleLineTable,
  documentTdDesc,
  documentTdNum,
  documentThDesc,
  documentThNum,
} from "@/lib/documents/document-table-classes";
import { fmtMoney } from "@/lib/documents/invoice-pdf-data";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function QuotePreviewPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const q = await prisma.quote.findFirst({
    where: { id, userId: session.sub },
    include: { customer: true, lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!q) notFound();

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10 print:bg-white">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm print:shadow-none">
        <p className="text-xs font-semibold uppercase text-teal-700">Quote</p>
        <h1 className="mt-1 text-2xl font-bold">{q.quoteNumber}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {q.customer.displayName} · {q.quoteDate.toLocaleDateString()} · {q.status}
        </p>
        <div className={documentLineTableScroll}>
          <table className={documentSimpleLineTable}>
            <thead>
              <tr className={documentLineTheadRowBorderB}>
                <th className={documentThDesc}>Description</th>
                <th className={documentThNum}>Qty</th>
                <th className={documentThNum}>Rate</th>
                <th className={documentThNum}>Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {q.lines.map((l) => (
                <tr key={l.id}>
                  <td className={documentTdDesc}>{l.description}</td>
                  <td className={documentTdNum}>{Number(l.quantity)}</td>
                  <td className={documentTdNum}>{fmtMoney(Number(l.rate))}</td>
                  <td className={documentTdNum}>{fmtMoney(Number(l.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-8 text-right text-lg font-semibold">Total {fmtMoney(Number(q.total))}</p>
        <div className="mt-8 flex gap-4 print:hidden">
          <Link href={`/dashboard/sales/quotes/${id}`} className="text-sm font-medium text-teal-700 hover:underline">
            ← Back
          </Link>
          <PrintButton />
        </div>
      </div>
    </div>
  );
}

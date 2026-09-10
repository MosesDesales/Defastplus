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

export default async function BillPreviewPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const b = await prisma.vendorBill.findFirst({
    where: { id, userId: session.sub },
    include: { vendor: true, lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!b) notFound();

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10 print:bg-white">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm print:shadow-none">
        <p className="text-xs font-semibold uppercase text-teal-700">Vendor bill</p>
        <h1 className="mt-1 text-2xl font-bold">{b.billNumber}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {b.vendor.displayName} · {b.billDate.toLocaleDateString()} · {b.status}
        </p>
        <div className={documentLineTableScroll}>
          <table className={documentSimpleLineTable}>
            <thead>
              <tr className={documentLineTheadRowBorderB}>
                <th className={documentThDesc}>Description</th>
                <th className={documentThNum}>Qty</th>
                <th className={documentThNum}>Rate</th>
                <th className={documentThNum}>Tax %</th>
                <th className={documentThNum}>Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {b.lines.map((l) => (
                <tr key={l.id}>
                  <td className={documentTdDesc}>{l.description}</td>
                  <td className={documentTdNum}>{Number(l.quantity)}</td>
                  <td className={documentTdNum}>{fmtMoney(Number(l.rate))}</td>
                  <td className={documentTdNum}>{Number(l.taxPercent)}</td>
                  <td className={documentTdNum}>{fmtMoney(Number(l.lineTotal))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="mt-6 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{fmtMoney(Number(b.subTotal))}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Tax</dt>
            <dd>{fmtMoney(Number(b.taxTotal))}</dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt>Total</dt>
            <dd>{fmtMoney(Number(b.total))}</dd>
          </div>
        </dl>
        <div className="mt-8 flex gap-4 print:hidden">
          <Link href={`/dashboard/purchases/bills/${id}`} className="text-sm font-medium text-teal-700 hover:underline">
            ← Back
          </Link>
          <PrintButton />
        </div>
      </div>
    </div>
  );
}

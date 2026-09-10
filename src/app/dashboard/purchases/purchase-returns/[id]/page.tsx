import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DocumentEWayBillAction } from "@/components/gst/DocumentEWayBillAction";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function PurchaseReturnDetailPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const ret = await prisma.purchaseReturn.findFirst({
    where: { id, userId: session.sub },
    include: {
      vendor: true,
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!ret) notFound();

  const showEway = ret.status !== "VOID" && ret.status !== "DRAFT";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link href="/dashboard/purchases/purchase-returns" className="text-sm font-medium text-teal-600 hover:underline">
        ← Purchase returns
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-slate-900 dark:text-white">{ret.returnNumber}</h1>
      <p className="mt-1 text-sm text-slate-600">
        {ret.vendor.displayName} · {ret.status} · {ret.returnDate.toLocaleDateString("en-IN")}
      </p>
      {ret.reason ? <p className="mt-2 text-sm text-slate-500">{ret.reason}</p> : null}

      {showEway ? (
        <DocumentEWayBillAction
          previewUrl={`/api/gst/eway-bills/from-purchase-return/${ret.id}`}
          createUrl={`/api/gst/eway-bills/from-purchase-return/${ret.id}`}
          documentNumber={ret.returnNumber}
          label="E-Way Bill (Purchase Return)"
        />
      ) : null}

      <div className="mt-8 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-950">
            <tr>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Rate</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {ret.lines.map((l) => (
              <tr key={l.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-2">{l.description}</td>
                <td className="px-3 py-2 text-right tabular-nums">{Number(l.quantity)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(Number(l.rate))}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(Number(l.lineTotal))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm font-semibold">Total: {fmt(Number(ret.total))}</p>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { DataTableShell } from "@/components/DataTableShell";
import { PageToolbar } from "@/components/PageToolbar";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function PaymentsReceivedPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const payments = await prisma.payment.findMany({
    where: { userId: session.sub },
    orderBy: { paymentDate: "desc" },
    include: { customer: { select: { displayName: true } } },
    take: 300,
  });

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Sales</p>
      <PageToolbar
        title="Payments received"
        subtitle="Customer receipts allocated to invoices; updates AR and invoice payment status."
        newButton={{ href: "/dashboard/sales/payments-received/new", label: "+ Record payment" }}
      />

      {payments.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-200 px-8 py-16 text-center dark:border-slate-700">
          <p className="text-slate-600 dark:text-slate-400">No payments recorded.</p>
          <Link
            href="/dashboard/sales/payments-received/new"
            className="mt-4 inline-block text-sm font-medium text-teal-600 dark:text-teal-400"
          >
            Record payment
          </Link>
        </div>
      ) : (
        <DataTableShell totalRows={payments.length}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/80">
                <tr>
                  <th className="px-4 py-3">Payment#</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium text-teal-700 dark:text-teal-400">{p.paymentNumber}</td>
                    <td className="px-4 py-3">{p.customer.displayName}</td>
                    <td className="px-4 py-3 tabular-nums">{p.paymentDate.toLocaleDateString()}</td>
                    <td className="px-4 py-3">{p.mode}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(Number(p.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataTableShell>
      )}
    </div>
  );
}

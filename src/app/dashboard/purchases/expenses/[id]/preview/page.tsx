import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/documents/PrintButton";
import { fmtMoney } from "@/lib/documents/invoice-pdf-data";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function ExpensePreviewPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const e = await prisma.purchaseExpense.findFirst({
    where: { id, userId: session.sub },
    include: { expenseAccount: true, bankAccount: true },
  });
  if (!e) notFound();

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10 print:bg-white">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm print:shadow-none">
        <p className="text-xs font-semibold uppercase text-teal-700">Purchase expense</p>
        <h1 className="mt-1 text-xl font-bold">{e.expenseDate.toLocaleDateString()}</h1>
        <dl className="mt-6 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-600">Expense</dt>
            <dd>
              {e.expenseAccount.code} — {e.expenseAccount.name}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600">Bank</dt>
            <dd>
              {e.bankAccount.code} — {e.bankAccount.name}
            </dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt>Amount</dt>
            <dd>{fmtMoney(Number(e.amount))}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Tax</dt>
            <dd>{fmtMoney(Number(e.taxAmount))}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Posted</dt>
            <dd>{e.journalEntryId ? "Yes" : "No"}</dd>
          </div>
        </dl>
        {e.notes?.trim() ? (
          <div className="mt-6 rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-900">
            {e.notes.trim()}
          </div>
        ) : null}
        <div className="mt-8 flex gap-4 print:hidden">
          <Link href={`/dashboard/purchases/expenses/${id}`} className="text-sm font-medium text-teal-700 hover:underline">
            ← Back
          </Link>
          <PrintButton />
        </div>
      </div>
    </div>
  );
}

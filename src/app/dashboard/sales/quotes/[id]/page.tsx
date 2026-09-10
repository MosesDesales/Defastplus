import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function QuoteDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { id } = await params;
  const quote = await prisma.quote.findFirst({
    where: { id, userId: session.sub },
    include: {
      customer: { select: { displayName: true, email: true } },
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!quote) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/dashboard/sales/quotes" className="text-sm font-medium text-teal-600 hover:underline dark:text-teal-400">
        ← Quotes
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-slate-900 dark:text-white">{quote.quoteNumber}</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        {quote.customer.displayName} · {quote.status}
      </p>

      <dl className="mt-8 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 text-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Total</dt>
          <dd className="font-semibold tabular-nums text-slate-900 dark:text-white">₹ {fmt(Number(quote.total))}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Quote date</dt>
          <dd className="tabular-nums text-slate-800 dark:text-slate-200">{quote.quoteDate.toLocaleDateString()}</dd>
        </div>
      </dl>

      <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
        Edit, PDF, email, and convert to invoice will plug in here.
      </p>
    </div>
  );
}

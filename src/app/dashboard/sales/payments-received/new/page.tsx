import Link from "next/link";
import { redirect } from "next/navigation";
import { PaymentRecordForm } from "@/components/PaymentRecordForm";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function NewPaymentPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const customers = await prisma.customer.findMany({
    where: { userId: session.sub },
    select: { id: true, displayName: true },
    orderBy: { displayName: "asc" },
  });

  const today = new Date();
  const defaultPaymentDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/dashboard/sales/payments-received" className="text-sm font-medium text-teal-600 hover:underline dark:text-teal-400">
        ← Payments received
      </Link>
      <h1 className="mt-6 text-2xl font-semibold text-slate-900 dark:text-white">Record payment</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Dr Bank / Cash · Cr Accounts Receivable — allocations update invoice paid / partial / paid status.
      </p>

      <PaymentRecordForm customers={customers} defaultPaymentDate={defaultPaymentDate} />
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { InvoiceCreateForm } from "@/components/InvoiceCreateForm";
import { ensureDefaultTemplatesForUser, listTemplatesForModule } from "@/lib/document-templates-service";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function NewInvoicePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  await ensureDefaultTemplatesForUser(prisma, session.sub);

  const [customers, items, company, invoiceTemplates] = await Promise.all([
    prisma.customer.findMany({
      where: { userId: session.sub },
      select: { id: true, displayName: true, gstin: true, currency: true },
      orderBy: { displayName: "asc" },
    }),
    prisma.item.findMany({
      where: { userId: session.sub },
      select: {
        id: true,
        name: true,
        salesRate: true,
        gstTaxPreference: true,
        gstApplicable: true,
        gstRate: true,
        hsnCode: true,
        gstTaxMode: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.companyProfile.findUnique({
      where: { userId: session.sub },
      select: { gstin: true, currency: true },
    }),
    listTemplatesForModule(prisma, session.sub, "invoices"),
  ]);

  const defaultInvoiceTemplateId =
    invoiceTemplates.find((t) => t.isDefaultForModule)?.id ?? invoiceTemplates[0]?.id ?? null;

  const today = new Date();
  const defaultIssueDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/dashboard/sales/invoices" className="text-sm font-medium text-teal-600 hover:underline dark:text-teal-400">
        ← Invoices
      </Link>
      <h1 className="mt-6 text-2xl font-semibold text-slate-900 dark:text-white">New invoice</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Creating as <strong>Sent</strong> posts Dr Accounts Receivable / Cr Sales / Cr GST output (system accounts).
      </p>

      <InvoiceCreateForm
        customers={customers}
        invoiceTemplates={invoiceTemplates}
        defaultInvoiceTemplateId={defaultInvoiceTemplateId}
        items={items.map((i) => ({
          id: i.id,
          name: i.name,
          salesRate: Number(i.salesRate),
          gstTaxPreference: i.gstTaxPreference,
          gstApplicable: i.gstApplicable,
          gstRate: Number(i.gstRate),
          hsnCode: i.hsnCode,
          gstTaxMode: i.gstTaxMode,
        }))}
        defaultIssueDate={defaultIssueDate}
        companyGstin={company?.gstin ?? null}
        baseCurrency={company?.currency ?? "INR"}
      />
    </div>
  );
}

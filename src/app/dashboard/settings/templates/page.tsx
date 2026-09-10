import { Suspense } from "react";
import { redirect } from "next/navigation";
import { TemplatesHubClient } from "@/components/settings/TemplatesHubClient";
import { companyAddressOneLine } from "@/lib/company-address-line";
import { isDocumentTemplateTypeSlug, type DocumentTemplateTypeSlug } from "@/lib/document-template-types";
import { ensureDefaultTemplatesForUser } from "@/lib/document-templates-service";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function TemplatesSettingsHomePage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ module?: string }> }>) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const raw = sp.module?.trim();
  const initialModule: DocumentTemplateTypeSlug =
    raw && isDocumentTemplateTypeSlug(raw) ? raw : "invoices";

  await ensureDefaultTemplatesForUser(prisma, session.sub);

  const company = await prisma.companyProfile.findUnique({
    where: { userId: session.sub },
    select: {
      companyName: true,
      gstin: true,
      logoUrl: true,
      billingStreet: true,
      billingCity: true,
      billingState: true,
      billingZip: true,
      billingCountry: true,
    },
  });

  const companyPayload = {
    companyName: company?.companyName?.trim() || "Your company",
    gstin: company?.gstin ?? null,
    logoUrl: company?.logoUrl ?? null,
    addressLine: companyAddressOneLine(company),
  };

  return (
    <Suspense
      fallback={<div className="mx-auto max-w-[1400px] p-12 text-center text-sm text-slate-500">Loading templates…</div>}
    >
      <TemplatesHubClient initialModule={initialModule} company={companyPayload} />
    </Suspense>
  );
}

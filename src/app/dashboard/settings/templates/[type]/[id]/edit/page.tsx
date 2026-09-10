import { notFound, redirect } from "next/navigation";
import { TemplateBuilderClient } from "@/components/settings/TemplateBuilderClient";
import { companyAddressOneLine } from "@/lib/company-address-line";
import { isDocumentTemplateTypeSlug, type DocumentTemplateTypeSlug } from "@/lib/document-template-types";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function EditTemplatePage({
  params,
}: Readonly<{ params: Promise<{ type: string; id: string }> }>) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { type: raw, id } = await params;
  if (!isDocumentTemplateTypeSlug(raw)) notFound();
  const type = raw as DocumentTemplateTypeSlug;

  const tpl = await prisma.documentTemplate.findFirst({
    where: {
      id,
      userId: session.sub,
      OR: [{ type }, { moduleMaps: { some: { moduleName: type } } }],
    },
    include: { moduleMaps: true },
  });
  if (!tpl) notFound();

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

  return <TemplateBuilderClient type={type} templateId={tpl.id} company={companyPayload} />;
}

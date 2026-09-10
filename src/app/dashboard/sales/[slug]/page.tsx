import { notFound } from "next/navigation";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { SALES_MODULES } from "@/lib/dashboard-nav";

const DEDICATED_SLUGS = new Set([
  "customers",
  "quotes",
  "invoices",
  "payments-received",
  "credit-notes",
  "recurring-invoices",
]);

export function generateStaticParams() {
  return SALES_MODULES.filter((m) => !DEDICATED_SLUGS.has(m.slug)).map((m) => ({ slug: m.slug }));
}

export default async function SalesModulePage({
  params,
}: Readonly<{
  params: Promise<{ slug: string }>;
}>) {
  const { slug } = await params;
  if (DEDICATED_SLUGS.has(slug)) {
    notFound();
  }
  const mod = SALES_MODULES.find((m) => m.slug === slug);
  if (!mod) {
    notFound();
  }
  return <ModulePlaceholder title={mod.label} description={mod.description} />;
}

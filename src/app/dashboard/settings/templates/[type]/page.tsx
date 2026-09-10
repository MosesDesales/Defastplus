import { redirect } from "next/navigation";
import { isDocumentTemplateTypeSlug } from "@/lib/document-template-types";

/** Legacy URL: /settings/templates/[type] → hub with ?module= */
export default async function LegacyTemplateTypeRedirect({
  params,
}: Readonly<{ params: Promise<{ type: string }> }>) {
  const { type } = await params;
  if (!isDocumentTemplateTypeSlug(type)) redirect("/settings/templates");
  redirect(`/settings/templates?module=${encodeURIComponent(type)}`);
}

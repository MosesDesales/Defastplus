import { notFound, redirect } from "next/navigation";
import { DocumentPreviewPage } from "@/components/documents/BusinessDocumentView";
import { loadQuoteBusinessDocument } from "@/lib/documents/load-business-document";
import { getSession } from "@/lib/session";

export default async function QuotePreviewPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const loaded = await loadQuoteBusinessDocument(session.sub, id);
  if (!loaded) notFound();
  return <DocumentPreviewPage doc={loaded.doc} backHref={`/dashboard/sales/quotes/${id}`} backLabel="Back to quote" pdfHref={`/api/quotes/${id}/pdf`} />;
}

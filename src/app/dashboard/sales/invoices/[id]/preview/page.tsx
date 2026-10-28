import { notFound, redirect } from "next/navigation";
import { DocumentPreviewPage } from "@/components/documents/BusinessDocumentView";
import { loadInvoiceBusinessDocument } from "@/lib/documents/load-business-document";
import { getSession } from "@/lib/session";

export default async function InvoicePreviewPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const loaded = await loadInvoiceBusinessDocument(session.sub, id);
  if (!loaded) notFound();
  return <DocumentPreviewPage doc={loaded.doc} backHref={`/dashboard/sales/invoices/${id}`} backLabel="Back to invoice" pdfHref={`/api/invoices/${id}/pdf`} />;
}

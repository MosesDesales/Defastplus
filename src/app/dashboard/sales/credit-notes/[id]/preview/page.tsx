import { notFound, redirect } from "next/navigation";
import { DocumentPreviewPage } from "@/components/documents/BusinessDocumentView";
import { loadCreditNoteBusinessDocument } from "@/lib/documents/load-business-document";
import { getSession } from "@/lib/session";

export default async function CreditNotePreviewPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const loaded = await loadCreditNoteBusinessDocument(session.sub, id);
  if (!loaded) notFound();
  return <DocumentPreviewPage doc={loaded.doc} backHref={"/dashboard/sales/credit-notes"} backLabel="Credit notes" pdfHref={`/api/sales/credit-notes/${id}/pdf`} />;
}

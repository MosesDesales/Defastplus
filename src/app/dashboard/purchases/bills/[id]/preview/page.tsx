import { notFound, redirect } from "next/navigation";
import { DocumentPreviewPage } from "@/components/documents/BusinessDocumentView";
import { loadBillBusinessDocument } from "@/lib/documents/load-business-document";
import { getSession } from "@/lib/session";

export default async function BillPreviewPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const loaded = await loadBillBusinessDocument(session.sub, id);
  if (!loaded) notFound();
  return <DocumentPreviewPage doc={loaded.doc} backHref={`/dashboard/purchases/bills/${id}`} backLabel="Back to bill" pdfHref={`/api/purchases/bills/${id}/pdf`} />;
}

import { notFound, redirect } from "next/navigation";
import { DocumentPreviewPage } from "@/components/documents/BusinessDocumentView";
import { loadExpenseBusinessDocument } from "@/lib/documents/load-business-document";
import { getSession } from "@/lib/session";

export default async function ExpensePreviewPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const loaded = await loadExpenseBusinessDocument(session.sub, id);
  if (!loaded) notFound();
  return <DocumentPreviewPage doc={loaded.doc} backHref={`/dashboard/purchases/expenses/${id}`} backLabel="Back to expense" pdfHref={`/api/purchases/expenses/${id}/pdf`} />;
}

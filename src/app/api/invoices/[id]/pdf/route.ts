import { NextResponse } from "next/server";
import { loadInvoiceBusinessDocument } from "@/lib/documents/load-business-document";
import { pdfResponse } from "@/lib/documents/pdf-response";
import { buildBusinessDocumentPdf } from "@/lib/pdf/business-document-pdf";
import { getSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const overrideTplId = new URL(request.url).searchParams.get("templateId")?.trim() || null;
  const loaded = await loadInvoiceBusinessDocument(session.sub, id, overrideTplId);
  if (!loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return pdfResponse(await buildBusinessDocumentPdf(loaded.doc), loaded.filename);
}

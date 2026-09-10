import { NextResponse } from "next/server";
import { parseTemplateConfigJson } from "@/lib/document-template-types";
import { prisma } from "@/lib/prisma";
import { buildInvoicePdfBuffer } from "@/lib/pdf/invoice-pdf";
import { loadCompanyForUser, loadInvoiceDocument } from "@/lib/documents/load-invoice-document";
import { getSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const inv = await loadInvoiceDocument(session.sub, id);
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(request.url);
  const overrideTplId = url.searchParams.get("templateId")?.trim() || null;

  let templateConfig = inv.documentTemplate?.configJson
    ? parseTemplateConfigJson(inv.documentTemplate.configJson)
    : null;
  if (overrideTplId) {
    const t = await prisma.documentTemplate.findFirst({
      where: {
        id: overrideTplId,
        userId: session.sub,
        OR: [
          { moduleMaps: { some: { moduleName: "invoices" } } },
          { AND: [{ type: "invoices" }, { moduleMaps: { none: {} } }] },
        ],
      },
    });
    if (t) templateConfig = parseTemplateConfigJson(t.configJson);
  }

  const company = await loadCompanyForUser(session.sub);
  const buf = await buildInvoicePdfBuffer({ invoice: inv, company }, { template: templateConfig });

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Invoice-${inv.invoiceNumber}.pdf"`,
    },
  });
}

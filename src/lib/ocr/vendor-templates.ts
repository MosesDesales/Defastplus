import type { PrismaClient } from "@prisma/client";
import type { OcrExtractedDocument } from "@/lib/ocr/types";

export type VendorLayoutHints = {
  invoiceNoLabel?: string;
  dateLabel?: string;
  totalLabel?: string;
  lineTableHeader?: string;
  partyGstinLine?: number;
};

function normalizeVendorKey(name?: string, gstin?: string): string {
  if (gstin?.trim()) return gstin.trim().toUpperCase();
  return (name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 80);
}

/** Find vendor-specific layout hints learned from prior successful extractions. */
export async function loadVendorTemplate(
  prisma: PrismaClient,
  userId: string,
  doc: OcrExtractedDocument,
): Promise<{ id: string; hints: VendorLayoutHints } | null> {
  const gstin = doc.partyGstin?.trim().toUpperCase();
  const nameKey = normalizeVendorKey(doc.partyName, gstin);

  const row = await prisma.ocrVendorTemplate.findFirst({
    where: {
      userId,
      OR: [
        ...(gstin ? [{ vendorGstin: gstin }] : []),
        { vendorNameKey: nameKey },
      ],
    },
    orderBy: { successCount: "desc" },
  });

  if (!row?.layoutHintsJson) return null;
  try {
    return { id: row.id, hints: JSON.parse(row.layoutHintsJson) as VendorLayoutHints };
  } catch {
    return null;
  }
}

/** Persist / update vendor layout after a successful OCR review. */
export async function recordVendorTemplateSuccess(
  prisma: PrismaClient,
  userId: string,
  doc: OcrExtractedDocument,
  rawTextPreview: string,
): Promise<void> {
  const gstin = doc.partyGstin?.trim().toUpperCase() || null;
  const nameKey = normalizeVendorKey(doc.partyName, gstin ?? undefined);
  if (!gstin && nameKey.length < 3) return;

  const hints: VendorLayoutHints = {
    invoiceNoLabel: doc.invoiceNo ? "invoice_no" : undefined,
    totalLabel: doc.total != null ? "grand_total" : undefined,
    lineTableHeader: doc.items.some((i) => i.hsnSac) ? "hsn_table" : undefined,
  };

  const existing = await prisma.ocrVendorTemplate.findFirst({
    where: {
      userId,
      OR: [
        ...(gstin ? [{ vendorGstin: gstin }] : []),
        { vendorNameKey: nameKey },
      ],
    },
  });

  if (existing) {
    await prisma.ocrVendorTemplate.update({
      where: { id: existing.id },
      data: {
        vendorGstin: gstin ?? existing.vendorGstin,
        vendorNameKey: nameKey,
        layoutHintsJson: JSON.stringify(hints),
        sampleTextPreview: rawTextPreview.slice(0, 4000),
        successCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
    return;
  }

  await prisma.ocrVendorTemplate.create({
    data: {
      userId,
      vendorGstin: gstin,
      vendorNameKey: nameKey,
      layoutHintsJson: JSON.stringify(hints),
      sampleTextPreview: rawTextPreview.slice(0, 4000),
      successCount: 1,
      lastUsedAt: new Date(),
    },
  });
}

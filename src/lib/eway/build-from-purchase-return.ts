import { prisma } from "@/lib/prisma";
import {
  buildAutomationReasons,
  mapTaxLinesToEWayLines,
  recipientFromVendor,
  supplierFromProfile,
  supplyTypeForParties,
  type EWayDraftPayload,
} from "@/lib/eway/build-document";

export type EWayDraftFromPurchaseReturn = EWayDraftPayload & {
  purchaseReturnId: string;
};

export async function buildEWayDraftFromPurchaseReturn(
  userId: string,
  purchaseReturnId: string,
): Promise<EWayDraftFromPurchaseReturn | null> {
  const [ret, profile, settings] = await Promise.all([
    prisma.purchaseReturn.findFirst({
      where: { id: purchaseReturnId, userId },
      include: {
        vendor: true,
        lines: { include: { item: true }, orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.companyProfile.findUnique({ where: { userId } }),
    prisma.eWayBillSettings.findUnique({ where: { userId } }),
  ]);

  if (!ret) return null;

  const inter = supplyTypeForParties(profile?.gstin, ret.vendor.gstin) === "I";
  const documentValue = Number(ret.total);
  const threshold = Number(settings?.valueThresholdInr ?? 50_000);
  const supplier = supplierFromProfile(profile);
  const recipient = recipientFromVendor(ret.vendor);

  return {
    documentType: "PURCHASE_RETURN",
    purchaseReturnId: ret.id,
    sourceDocumentNumber: ret.returnNumber,
    sourceDocumentDate: ret.returnDate,
    documentValue,
    ...supplier,
    customerId: null,
    ...recipient,
    supplyType: supplyTypeForParties(profile?.gstin, ret.vendor.gstin),
    subSupplyType: "Return",
    lines: mapTaxLinesToEWayLines(ret.lines, inter),
    automation: buildAutomationReasons({
      documentValue,
      threshold,
      inter,
      autoSuggestInterstate: settings?.autoSuggestInterstate,
      autoSuggestOverThreshold: settings?.autoSuggestOverThreshold,
      extraReasons: ["Purchase return — goods moving back to supplier."],
    }),
  };
}

export async function existingEWayForPurchaseReturn(userId: string, purchaseReturnId: string) {
  return prisma.eWayBill.findFirst({
    where: { userId, purchaseReturnId, status: { notIn: ["CANCELLED", "ERROR"] } },
    orderBy: { createdAt: "desc" },
  });
}

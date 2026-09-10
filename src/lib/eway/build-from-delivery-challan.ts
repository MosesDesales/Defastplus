import { prisma } from "@/lib/prisma";
import {
  buildAutomationReasons,
  mapTaxLinesToEWayLines,
  recipientFromCustomer,
  supplierFromProfile,
  supplyTypeForParties,
  type EWayDraftPayload,
} from "@/lib/eway/build-document";

export type EWayDraftFromDeliveryChallan = EWayDraftPayload & {
  deliveryChallanId: string;
  customerId: string;
};

export async function buildEWayDraftFromDeliveryChallan(
  userId: string,
  challanId: string,
): Promise<EWayDraftFromDeliveryChallan | null> {
  const [challan, profile, settings] = await Promise.all([
    prisma.deliveryChallan.findFirst({
      where: { id: challanId, userId },
      include: {
        customer: true,
        lines: { include: { item: true }, orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.companyProfile.findUnique({ where: { userId } }),
    prisma.eWayBillSettings.findUnique({ where: { userId } }),
  ]);

  if (!challan) return null;

  const inter = supplyTypeForParties(profile?.gstin, challan.customer.gstin) === "I";
  const documentValue = Number(challan.total);
  const threshold = Number(settings?.valueThresholdInr ?? 50_000);
  const supplier = supplierFromProfile(profile);
  const recipient = recipientFromCustomer(challan.customer);

  return {
    documentType: "DELIVERY_CHALLAN",
    deliveryChallanId: challan.id,
    customerId: challan.customerId,
    sourceDocumentNumber: challan.challanNumber,
    sourceDocumentDate: challan.challanDate,
    documentValue,
    ...supplier,
    ...recipient,
    supplyType: supplyTypeForParties(profile?.gstin, challan.customer.gstin),
    subSupplyType: null,
    lines: mapTaxLinesToEWayLines(challan.lines, inter),
    automation: buildAutomationReasons({
      documentValue,
      threshold,
      inter,
      autoSuggestInterstate: settings?.autoSuggestInterstate,
      autoSuggestOverThreshold: settings?.autoSuggestOverThreshold,
      extraReasons: ["Delivery challan shipment may require E-Way Bill when goods move without tax invoice."],
    }),
  };
}

export async function existingEWayForDeliveryChallan(userId: string, challanId: string) {
  return prisma.eWayBill.findFirst({
    where: { userId, deliveryChallanId: challanId, status: { notIn: ["CANCELLED", "ERROR"] } },
    orderBy: { createdAt: "desc" },
  });
}

import { prisma } from "@/lib/prisma";

export async function loadInvoiceDocument(userId: string, id: string) {
  return prisma.invoice.findFirst({
    where: { id, userId },
    include: {
      customer: true,
      lines: { orderBy: { sortOrder: "asc" }, include: { item: { select: { hsnCode: true, unit: true } } } },
      documentTemplate: true,
    },
  });
}

export async function loadCompanyForUser(userId: string) {
  return prisma.companyProfile.findUnique({ where: { userId } });
}

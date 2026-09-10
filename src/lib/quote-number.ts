import { prisma } from "@/lib/prisma";

export async function getNextQuoteNumber(userId: string): Promise<string> {
  const rows = await prisma.quote.findMany({
    where: { userId },
    select: { quoteNumber: true },
  });
  let max = 0;
  for (const r of rows) {
    const m = /^QT-(\d+)$/i.exec(r.quoteNumber.trim());
    if (m) {
      max = Math.max(max, parseInt(m[1], 10));
    }
  }
  return `QT-${String(max + 1).padStart(6, "0")}`;
}

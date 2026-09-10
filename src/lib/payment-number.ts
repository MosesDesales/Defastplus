import { prisma } from "@/lib/prisma";

export async function getNextPaymentNumber(userId: string): Promise<string> {
  const rows = await prisma.payment.findMany({
    where: { userId },
    select: { paymentNumber: true },
  });
  let max = 0;
  for (const r of rows) {
    const m = /^PAY-(\d+)$/i.exec(r.paymentNumber.trim());
    if (m) {
      max = Math.max(max, parseInt(m[1], 10));
    }
  }
  return `PAY-${String(max + 1).padStart(6, "0")}`;
}

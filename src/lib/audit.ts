import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function writeAuditLog(
  userId: string,
  action: string,
  entity: string,
  entityId?: string | null,
  meta?: Record<string, unknown>,
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId: entityId ?? undefined,
        meta: meta ? (meta as unknown as Prisma.InputJsonValue) : undefined,
      },
    });
  } catch {
    /* non-fatal */
  }
}

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PERMISSION_PRESETS } from "@/lib/permissions";

/** Seed example roles for a new tenant (idempotent per slug). */
export async function seedDefaultAppRoles(userId: string) {
  const presets: Array<{ slug: string; name: string; key: keyof typeof PERMISSION_PRESETS }> = [
    { slug: "admin", name: "Administrator", key: "admin" },
    { slug: "accountant", name: "Accounting", key: "accountant" },
    { slug: "sales-user", name: "Sales User", key: "sales-user" },
    { slug: "hr-manager", name: "HR Manager", key: "hr-manager" },
  ];

  for (const p of presets) {
    const perms = PERMISSION_PRESETS[p.key];
    await prisma.appRole.upsert({
      where: { userId_slug: { userId, slug: p.slug } },
      create: {
        userId,
        name: p.name,
        slug: p.slug,
        permissions: perms as unknown as Prisma.InputJsonValue,
        isSystem: true,
      },
      update: {},
    });
  }
}

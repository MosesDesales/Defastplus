/**
 * Creates a Super User, or promotes an existing account. Credentials come from the
 * environment so they never live in source control or shell scripts:
 *
 *   SUPER_USER_EMAIL=... SUPER_USER_PASSWORD=... npm run superuser:create
 *
 * For an existing account the password is only changed when SUPER_USER_RESET_PASSWORD=1.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { seedDefaultAppRoles } from "../src/lib/settings/seed-roles";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_USER_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_USER_PASSWORD;
  const name = process.env.SUPER_USER_NAME?.trim() || "Super User";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Set SUPER_USER_EMAIL to a valid email");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const resetPassword = process.env.SUPER_USER_RESET_PASSWORD === "1";
    if (resetPassword && (!password || password.length < 8)) throw new Error("SUPER_USER_PASSWORD must be at least 8 characters");
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        isSuperUser: true,
        isActive: true,
        deactivatedAt: null,
        ...(resetPassword ? { passwordHash: await bcrypt.hash(password!, 12), sessionVersion: { increment: 1 } } : {}),
      },
    });
    console.log(`✓ Promoted ${email} to Super User${resetPassword ? " (password reset)" : ""}`);
    return;
  }

  if (!password || password.length < 8) throw new Error("SUPER_USER_PASSWORD must be at least 8 characters");
  const user = await prisma.user.create({
    data: { email, name, passwordHash: await bcrypt.hash(password, 12), isSuperUser: true },
  });
  await seedDefaultAppRoles(user.id);
  console.log(`✓ Created Super User ${email} (${user.id})`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

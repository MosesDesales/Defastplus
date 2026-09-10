import { prisma } from "@/lib/prisma";
import {
  applyModuleDependencies,
  DEFAULT_ORGANIZATION_MODULE_SETTINGS,
  rowToModuleSettings,
  type OrganizationModuleSettingsDTO,
} from "@/lib/organization-module-settings";

export async function getEffectiveModuleSettings(userId: string): Promise<OrganizationModuleSettingsDTO> {
  const row = await prisma.organizationSettings.findUnique({ where: { userId } });
  if (!row) {
    return applyModuleDependencies({ ...DEFAULT_ORGANIZATION_MODULE_SETTINGS });
  }
  return applyModuleDependencies(rowToModuleSettings(row));
}

export async function getOrCreateOrganizationSettingsRow(userId: string) {
  return prisma.organizationSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

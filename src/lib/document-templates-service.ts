import type { Prisma, PrismaClient } from "@prisma/client";

import {
  DOCUMENT_TEMPLATE_TYPES,
  type DocumentTemplateTypeSlug,
} from "@/lib/document-template-types";
import {
  DOCUMENT_TEMPLATE_PRESET_NAMES,
  DOCUMENT_TEMPLATE_PRESETS,
} from "@/lib/document-template-presets";

type Db = PrismaClient | Prisma.TransactionClient;

/** Seed the nine built-in layout presets once per user. */
async function ensurePresetTemplates(db: Db, userId: string): Promise<Map<string, string>> {
  const existing = await db.documentTemplate.findMany({
    where: { userId, name: { in: [...DOCUMENT_TEMPLATE_PRESET_NAMES] } },
    select: { id: true, name: true },
  });
  const byName = new Map(existing.map((t) => [t.name, t.id]));

  for (const preset of DOCUMENT_TEMPLATE_PRESETS) {
    if (byName.has(preset.name)) continue;
    const created = await db.documentTemplate.create({
      data: {
        userId,
        type: "invoices",
        name: preset.name,
        isDefault: false,
        configJson: JSON.stringify(preset.config),
      },
    });
    byName.set(preset.name, created.id);
  }

  return byName;
}

/** Map all preset templates to a module and pick a default when none exists. */
async function ensureModulePresetMappings(
  db: Db,
  userId: string,
  moduleName: DocumentTemplateTypeSlug,
  presetIds: Map<string, string>,
): Promise<void> {
  for (const preset of DOCUMENT_TEMPLATE_PRESETS) {
    const templateId = presetIds.get(preset.name);
    if (!templateId) continue;
    await db.documentTemplateModuleMap.upsert({
      where: { templateId_moduleName: { templateId, moduleName } },
      create: { templateId, moduleName },
      update: {},
    });
  }

  const hasDefault = await db.userDocumentTemplateDefault.findUnique({
    where: { userId_moduleName: { userId, moduleName } },
  });
  if (!hasDefault) {
    const defaultId = presetIds.get(DOCUMENT_TEMPLATE_PRESETS[0]?.name ?? "Ocean Teal");
    if (defaultId) {
      await db.userDocumentTemplateDefault.create({
        data: { userId, moduleName, templateId: defaultId },
      });
    }
  }
}

/** Legacy rows: add primary map from `type` and seed `UserDocumentTemplateDefault` from `isDefault`. */
async function backfillLegacyTemplateModuleData(db: Db, userId: string): Promise<void> {
  const templates = await db.documentTemplate.findMany({
    where: { userId },
    include: { moduleMaps: true },
  });
  for (const t of templates) {
    if (t.moduleMaps.length === 0) {
      await db.documentTemplateModuleMap.create({
        data: { templateId: t.id, moduleName: t.type },
      });
    }
  }
  const again = await db.documentTemplate.findMany({
    where: { userId },
    include: { moduleMaps: true },
  });
  for (const t of again) {
    if (t.isDefault) {
      await db.userDocumentTemplateDefault.upsert({
        where: { userId_moduleName: { userId, moduleName: t.type } },
        create: { userId, moduleName: t.type, templateId: t.id },
        update: { templateId: t.id },
      });
    }
  }
}

/** Keeps `DocumentTemplate.isDefault` aligned when the default module matches the template's primary `type`. */
async function syncIsDefaultColumnWithModuleDefaults(db: Db, userId: string): Promise<void> {
  await db.documentTemplate.updateMany({ where: { userId }, data: { isDefault: false } });
  const defs = await db.userDocumentTemplateDefault.findMany({ where: { userId } });
  for (const d of defs) {
    const tpl = await db.documentTemplate.findFirst({ where: { id: d.templateId, userId } });
    if (tpl && tpl.type === d.moduleName) {
      await db.documentTemplate.update({ where: { id: tpl.id }, data: { isDefault: true } });
    }
  }
}

export async function ensureDefaultTemplatesForUser(db: Db, userId: string): Promise<void> {
  await backfillLegacyTemplateModuleData(db, userId);

  const presetIds = await ensurePresetTemplates(db, userId);

  for (const moduleName of DOCUMENT_TEMPLATE_TYPES) {
    await ensureModulePresetMappings(db, userId, moduleName, presetIds);

    const hasDefault = await db.userDocumentTemplateDefault.findUnique({
      where: { userId_moduleName: { userId, moduleName } },
    });
    if (!hasDefault) {
      const first = await db.documentTemplate.findFirst({
        where: { userId, moduleMaps: { some: { moduleName } } },
        orderBy: { createdAt: "asc" },
      });
      if (first) {
        await db.userDocumentTemplateDefault.create({
          data: { userId, moduleName, templateId: first.id },
        });
      }
    }
  }

  await syncIsDefaultColumnWithModuleDefaults(db, userId);
}

export async function getDefaultTemplateId(
  db: Db,
  userId: string,
  type: DocumentTemplateTypeSlug,
): Promise<string | null> {
  await ensureDefaultTemplatesForUser(db, userId);
  const row = await db.userDocumentTemplateDefault.findUnique({
    where: { userId_moduleName: { userId, moduleName: type } },
    select: { templateId: true },
  });
  return row?.templateId ?? null;
}

export async function listTemplatesForModule(
  db: Db,
  userId: string,
  module: DocumentTemplateTypeSlug,
): Promise<
  {
    id: string;
    type: string;
    name: string;
    isDefault: boolean;
    configJson: string;
    thumbnailUrl: string | null;
    exportFileNamePattern: string | null;
    updatedAt: Date;
    moduleNames: string[];
    isDefaultForModule: boolean;
  }[]
> {
  await ensureDefaultTemplatesForUser(db, userId);
  const defaultRow = await db.userDocumentTemplateDefault.findUnique({
    where: { userId_moduleName: { userId, moduleName: module } },
    select: { templateId: true },
  });
  const defaultId = defaultRow?.templateId ?? null;

  const templates = await db.documentTemplate.findMany({
    where: {
      userId,
      OR: [
        { moduleMaps: { some: { moduleName: module } } },
        { AND: [{ type: module }, { moduleMaps: { none: {} } }] },
      ],
    },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      type: true,
      name: true,
      isDefault: true,
      configJson: true,
      thumbnailUrl: true,
      exportFileNamePattern: true,
      updatedAt: true,
      moduleMaps: { select: { moduleName: true } },
    },
  });

  const rows = templates.map((t) => {
    const moduleNames =
      t.moduleMaps.length > 0 ? t.moduleMaps.map((m) => m.moduleName) : [t.type];
    return {
      id: t.id,
      type: t.type,
      name: t.name,
      isDefault: t.isDefault,
      configJson: t.configJson,
      thumbnailUrl: t.thumbnailUrl,
      exportFileNamePattern: t.exportFileNamePattern,
      updatedAt: t.updatedAt,
      moduleNames,
      isDefaultForModule: t.id === defaultId,
    };
  });

  rows.sort((a, b) => {
    if (a.isDefaultForModule !== b.isDefaultForModule) return a.isDefaultForModule ? -1 : 1;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
  return rows;
}

export async function resolveInvoiceTemplateId(
  db: Db,
  userId: string,
  requestedId: string | null | undefined,
): Promise<string | null> {
  await ensureDefaultTemplatesForUser(db, userId);
  if (requestedId?.trim()) {
    const found = await db.documentTemplate.findFirst({
      where: {
        id: requestedId.trim(),
        userId,
        OR: [
          { moduleMaps: { some: { moduleName: "invoices" } } },
          { AND: [{ type: "invoices" }, { moduleMaps: { none: {} } }] },
        ],
      },
      select: { id: true },
    });
    if (found) return found.id;
  }
  return getDefaultTemplateId(db, userId, "invoices");
}

export async function setTemplateAsDefault(
  db: Db,
  userId: string,
  templateId: string,
  moduleName: DocumentTemplateTypeSlug,
): Promise<void> {
  const t = await db.documentTemplate.findFirst({
    where: { id: templateId, userId },
  });
  if (!t) throw new Error("Template not found");
  await db.documentTemplateModuleMap.upsert({
    where: { templateId_moduleName: { templateId, moduleName } },
    create: { templateId, moduleName },
    update: {},
  });
  await db.userDocumentTemplateDefault.upsert({
    where: { userId_moduleName: { userId, moduleName } },
    create: { userId, moduleName, templateId },
    update: { templateId },
  });
  await syncIsDefaultColumnWithModuleDefaults(db, userId);
}

export async function canDeleteTemplate(
  db: Db,
  userId: string,
  templateId: string,
): Promise<{ ok: boolean; reason?: "not_found" | "default_for_module" | "last_for_module"; moduleName?: string }> {
  const t = await db.documentTemplate.findFirst({
    where: { id: templateId, userId },
    include: { moduleMaps: true },
  });
  if (!t) return { ok: false, reason: "not_found" };

  const isDefaultPick = await db.userDocumentTemplateDefault.findFirst({
    where: { userId, templateId },
  });
  if (isDefaultPick) {
    return { ok: false, reason: "default_for_module" };
  }

  for (const m of t.moduleMaps) {
    const others = await db.documentTemplate.count({
      where: {
        userId,
        id: { not: templateId },
        moduleMaps: { some: { moduleName: m.moduleName } },
      },
    });
    if (others === 0) {
      return { ok: false, reason: "last_for_module", moduleName: m.moduleName };
    }
  }

  return { ok: true };
}

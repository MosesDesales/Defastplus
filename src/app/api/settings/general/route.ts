import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  applyModuleDependencies,
  DEFAULT_ORGANIZATION_MODULE_SETTINGS,
  rowToModuleSettings,
  type OrganizationModuleSettingsDTO,
} from "@/lib/organization-module-settings";
import { canManageOrganizationModuleSettings } from "@/lib/permissions";
import { getEffectiveModuleSettings, getOrCreateOrganizationSettingsRow } from "@/lib/organization-settings-db";

const KEYS = [
  "quotesEnabled",
  "deliveryChallanEnabled",
  "recurringInvoiceEnabled",
  "creditNoteEnabled",
  "paymentLinksEnabled",
  "purchaseOrderEnabled",
  "recurringExpenseEnabled",
  "recurringBillsEnabled",
  "vendorCreditEnabled",
  "manualJournalEnabled",
  "recurringJournalEnabled",
  "fixedAssetsEnabled",
  "timeTrackingEnabled",
  "tasksEnabled",
  "payrollEnabled",
  "inventoryEnabled",
  "warehousesEnabled",
  "batchTrackingEnabled",
  "serialTrackingEnabled",
  "ocrEnabled",
  "tallyEnabled",
  "zohoBooksEnabled",
  "quickbooksEnabled",
] as const satisfies readonly (keyof OrganizationModuleSettingsDTO)[];

function pickBooleans(input: unknown): Partial<OrganizationModuleSettingsDTO> | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const out: Partial<OrganizationModuleSettingsDTO> = {};
  for (const k of KEYS) {
    if (k in o && typeof o[k] === "boolean") {
      (out as Record<string, boolean>)[k] = o[k] as boolean;
    }
  }
  return out;
}

export async function GET() {
  const session = await requireApiPermission("settings.view");
  if (session instanceof NextResponse) return session;

  const effective = await getEffectiveModuleSettings(session.sub);
  const canManage = canManageOrganizationModuleSettings(session.permissions);

  return NextResponse.json({
    settings: effective,
    canManage,
  });
}

export async function PUT(request: Request) {
  const session = await requireApiPermission("settings.view");
  if (session instanceof NextResponse) return session;

  if (!canManageOrganizationModuleSettings(session.permissions)) {
    return NextResponse.json({ error: "Only organization administrators can change module settings." }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = json as { settings?: unknown; restoreDefaults?: unknown };

  if (body.restoreDefaults === true) {
    await prisma.organizationSettings.upsert({
      where: { userId: session.sub },
      create: { userId: session.sub },
      update: {
        ...DEFAULT_ORGANIZATION_MODULE_SETTINGS,
      },
    });
    const effective = await getEffectiveModuleSettings(session.sub);
    return NextResponse.json({ settings: effective, ok: true });
  }

  const partial = pickBooleans(body.settings);
  if (!partial || Object.keys(partial).length === 0) {
    return NextResponse.json({ error: "Missing settings object with boolean fields" }, { status: 400 });
  }

  const current = rowToModuleSettings(await getOrCreateOrganizationSettingsRow(session.sub));
  const merged: OrganizationModuleSettingsDTO = { ...current, ...partial };
  const coerced = applyModuleDependencies(merged);

  await prisma.organizationSettings.update({
    where: { userId: session.sub },
    data: {
      quotesEnabled: coerced.quotesEnabled,
      deliveryChallanEnabled: coerced.deliveryChallanEnabled,
      recurringInvoiceEnabled: coerced.recurringInvoiceEnabled,
      creditNoteEnabled: coerced.creditNoteEnabled,
      paymentLinksEnabled: coerced.paymentLinksEnabled,
      purchaseOrderEnabled: coerced.purchaseOrderEnabled,
      recurringExpenseEnabled: coerced.recurringExpenseEnabled,
      recurringBillsEnabled: coerced.recurringBillsEnabled,
      vendorCreditEnabled: coerced.vendorCreditEnabled,
      manualJournalEnabled: coerced.manualJournalEnabled,
      recurringJournalEnabled: coerced.recurringJournalEnabled,
      fixedAssetsEnabled: coerced.fixedAssetsEnabled,
      timeTrackingEnabled: coerced.timeTrackingEnabled,
      tasksEnabled: coerced.tasksEnabled,
      payrollEnabled: coerced.payrollEnabled,
      inventoryEnabled: coerced.inventoryEnabled,
      warehousesEnabled: coerced.warehousesEnabled,
      batchTrackingEnabled: coerced.batchTrackingEnabled,
      serialTrackingEnabled: coerced.serialTrackingEnabled,
      ocrEnabled: coerced.ocrEnabled,
      tallyEnabled: coerced.tallyEnabled,
      zohoBooksEnabled: coerced.zohoBooksEnabled,
      quickbooksEnabled: coerced.quickbooksEnabled,
    },
  });

  return NextResponse.json({ settings: coerced, ok: true });
}

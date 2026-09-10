import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";
import { isValidGstin, normalizeGstin } from "@/lib/gstin";
import { defaultGstSettingsDTO, rowToGstSettingsDTO, type GstSettingsDTO } from "@/lib/gst-settings-dto";

function parseBody(input: unknown): GstSettingsDTO | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const d = defaultGstSettingsDTO();
  if (typeof o.gstRegistered === "boolean") d.gstRegistered = o.gstRegistered;
  if (typeof o.gstin === "string") d.gstin = o.gstin;
  if (typeof o.gstRegistrationType === "string") d.gstRegistrationType = o.gstRegistrationType;
  if (typeof o.gstBusinessLegalName === "string") d.gstBusinessLegalName = o.gstBusinessLegalName;
  if (typeof o.gstBusinessTradeName === "string") d.gstBusinessTradeName = o.gstBusinessTradeName;
  if (typeof o.gstRegisteredOn === "string") d.gstRegisteredOn = o.gstRegisteredOn;
  if (typeof o.gstReverseChargeSales === "boolean") d.gstReverseChargeSales = o.gstReverseChargeSales;
  if (typeof o.gstSezOverseasTrading === "boolean") d.gstSezOverseasTrading = o.gstSezOverseasTrading;
  if (typeof o.gstDigitalServicesExport === "boolean") d.gstDigitalServicesExport = o.gstDigitalServicesExport;
  return d;
}

export async function GET() {
  const session = await requireApiPermission("settings.view");
  if (session instanceof NextResponse) return session;

  const row = await prisma.companyProfile.findUnique({ where: { userId: session.sub } });
  return NextResponse.json({ settings: rowToGstSettingsDTO(row) });
}

export async function PATCH(request: Request) {
  const session = await requireApiPermission("settings.edit");
  if (session instanceof NextResponse) return session;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = parseBody(json);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const gstinNorm = normalizeGstin(body.gstin);
  if (body.gstRegistered) {
    if (!gstinNorm) return NextResponse.json({ error: "GSTIN is required when registered for GST" }, { status: 400 });
    if (!isValidGstin(gstinNorm)) return NextResponse.json({ error: "GSTIN format is invalid" }, { status: 400 });
    if (!body.gstRegistrationType.trim()) {
      return NextResponse.json({ error: "Registration type is required" }, { status: 400 });
    }
  }

  let registeredOn: Date | null = null;
  if (body.gstRegisteredOn.trim()) {
    const d = new Date(`${body.gstRegisteredOn.trim()}T12:00:00.000Z`);
    if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "Invalid registration date" }, { status: 400 });
    registeredOn = d;
  }

  const data = {
    gstRegistered: body.gstRegistered,
    gstin: body.gstRegistered ? gstinNorm || null : null,
    gstRegistrationType: body.gstRegistered ? body.gstRegistrationType.trim() || null : null,
    gstBusinessLegalName: body.gstBusinessLegalName.trim() || null,
    gstBusinessTradeName: body.gstBusinessTradeName.trim() || null,
    gstRegisteredOn: body.gstRegistered ? registeredOn : null,
    gstReverseChargeSales: body.gstReverseChargeSales,
    gstSezOverseasTrading: body.gstSezOverseasTrading,
    gstDigitalServicesExport: body.gstDigitalServicesExport,
  };

  const row = await prisma.companyProfile.upsert({
    where: { userId: session.sub },
    create: {
      userId: session.sub,
      ...data,
    },
    update: data,
  });

  await writeAuditLog(session.sub, "UPDATE", "CompanyProfile", row.id);

  return NextResponse.json({ ok: true, message: "GST settings saved", settings: rowToGstSettingsDTO(row) });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  const session = await requireApiPermission("settings.view");
  if (session instanceof NextResponse) return session;

  const row = await prisma.companyProfile.findUnique({
    where: { userId: session.sub },
  });

  return NextResponse.json({
    profile: row
      ? {
          companyName: row.companyName,
          logoUrl: row.logoUrl,
          billingStreet: row.billingStreet,
          billingStreet2: row.billingStreet2,
          billingCity: row.billingCity,
          billingState: row.billingState,
          billingZip: row.billingZip,
          billingCountry: row.billingCountry,
          gstin: row.gstin,
          pan: row.pan,
          companyIdentifier: row.companyIdentifier,
          financialYearStartMonth: row.financialYearStartMonth,
          currency: row.currency,
          industry: row.industry,
          phone: row.phone,
          fax: row.fax,
          websiteUrl: row.websiteUrl,
          reportBasis: row.reportBasis,
          timezone: row.timezone,
          dateFormat: row.dateFormat,
          organizationLanguage: row.organizationLanguage,
          communicationLanguages: row.communicationLanguages,
        }
      : null,
  });
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

  const d = json as Record<string, unknown>;

  const row = await prisma.companyProfile.upsert({
    where: { userId: session.sub },
    create: {
      userId: session.sub,
      companyName: d.companyName != null ? String(d.companyName) : null,
      logoUrl: d.logoUrl != null ? String(d.logoUrl) : null,
      billingStreet: d.billingStreet != null ? String(d.billingStreet) : null,
      billingStreet2: d.billingStreet2 != null ? String(d.billingStreet2) : null,
      billingCity: d.billingCity != null ? String(d.billingCity) : null,
      billingState: d.billingState != null ? String(d.billingState) : null,
      billingZip: d.billingZip != null ? String(d.billingZip) : null,
      billingCountry: d.billingCountry != null ? String(d.billingCountry) : "IN",
      gstin: d.gstin != null ? String(d.gstin) : null,
      pan: d.pan != null ? String(d.pan) : null,
      companyIdentifier: d.companyIdentifier != null ? String(d.companyIdentifier) : null,
      financialYearStartMonth:
        d.financialYearStartMonth != null ? parseInt(String(d.financialYearStartMonth), 10) || 4 : 4,
      currency: d.currency != null ? String(d.currency) : "INR",
      industry: d.industry != null ? String(d.industry) : null,
      phone: d.phone != null ? String(d.phone) : null,
      fax: d.fax != null ? String(d.fax) : null,
      websiteUrl: d.websiteUrl != null ? String(d.websiteUrl) : null,
    },
    update: {
      ...(d.companyName !== undefined ? { companyName: d.companyName ? String(d.companyName) : null } : {}),
      ...(d.logoUrl !== undefined ? { logoUrl: d.logoUrl ? String(d.logoUrl) : null } : {}),
      ...(d.billingStreet !== undefined ? { billingStreet: d.billingStreet ? String(d.billingStreet) : null } : {}),
      ...(d.billingStreet2 !== undefined ? { billingStreet2: d.billingStreet2 ? String(d.billingStreet2) : null } : {}),
      ...(d.billingCity !== undefined ? { billingCity: d.billingCity ? String(d.billingCity) : null } : {}),
      ...(d.billingState !== undefined ? { billingState: d.billingState ? String(d.billingState) : null } : {}),
      ...(d.billingZip !== undefined ? { billingZip: d.billingZip ? String(d.billingZip) : null } : {}),
      ...(d.billingCountry !== undefined ? { billingCountry: String(d.billingCountry || "IN") } : {}),
      ...(d.gstin !== undefined ? { gstin: d.gstin ? String(d.gstin) : null } : {}),
      ...(d.pan !== undefined ? { pan: d.pan ? String(d.pan) : null } : {}),
      ...(d.companyIdentifier !== undefined
        ? { companyIdentifier: d.companyIdentifier ? String(d.companyIdentifier) : null }
        : {}),
      ...(d.financialYearStartMonth !== undefined
        ? { financialYearStartMonth: parseInt(String(d.financialYearStartMonth), 10) || 4 }
        : {}),
      ...(d.currency !== undefined ? { currency: String(d.currency || "INR") } : {}),
      ...(d.industry !== undefined ? { industry: d.industry ? String(d.industry) : null } : {}),
      ...(d.phone !== undefined ? { phone: d.phone ? String(d.phone) : null } : {}),
      ...(d.fax !== undefined ? { fax: d.fax ? String(d.fax) : null } : {}),
      ...(d.websiteUrl !== undefined ? { websiteUrl: d.websiteUrl ? String(d.websiteUrl) : null } : {}),
    },
  });

  await writeAuditLog(session.sub, "UPDATE", "CompanyProfile", row.id);

  return NextResponse.json({ ok: true });
}

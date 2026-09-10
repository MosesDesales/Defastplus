import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, signSession } from "@/lib/auth";
import { requireApiPermission } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";
import { isPublicEmailDomain } from "@/lib/email-public-domain";
import { isValidGstin, normalizeGstin } from "@/lib/gstin";
import { alignCurrencyBaseWithCompanyProfile, ensureDefaultCurrencies } from "@/lib/currencies/service";
import {
  companyRowToDTO,
  defaultOrganizationProfileDTO,
  type OrganizationProfileDTO,
} from "@/lib/organization-profile-dto";
import { parsePermissionsJson } from "@/lib/permissions";

const MAX_LOGO_BYTES = 1 * 1024 * 1024;

function logoPayloadTooLarge(logoUrl: string): boolean {
  if (!logoUrl || !logoUrl.startsWith("data:image")) return false;
  const base64Idx = logoUrl.indexOf("base64,");
  if (base64Idx === -1) return logoUrl.length > 1_400_000;
  const b64 = logoUrl.slice(base64Idx + 7);
  const approx = (b64.length * 3) / 4;
  return approx > MAX_LOGO_BYTES;
}

function pickOrg(input: unknown): OrganizationProfileDTO | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const d = defaultOrganizationProfileDTO();
  if (typeof o.companyName === "string") d.companyName = o.companyName;
  if (typeof o.logoUrl === "string") d.logoUrl = o.logoUrl;
  if (typeof o.industry === "string") d.industry = o.industry;
  if (typeof o.billingCountry === "string") d.billingCountry = o.billingCountry;
  if (typeof o.billingStreet === "string") d.billingStreet = o.billingStreet;
  if (typeof o.billingStreet2 === "string") d.billingStreet2 = o.billingStreet2;
  if (typeof o.billingCity === "string") d.billingCity = o.billingCity;
  if (typeof o.billingState === "string") d.billingState = o.billingState;
  if (typeof o.billingZip === "string") d.billingZip = o.billingZip;
  if (typeof o.phone === "string") d.phone = o.phone;
  if (typeof o.fax === "string") d.fax = o.fax;
  if (typeof o.websiteUrl === "string") d.websiteUrl = o.websiteUrl;
  if (typeof o.paymentAddressDifferent === "boolean") d.paymentAddressDifferent = o.paymentAddressDifferent;
  if (typeof o.paymentStreet === "string") d.paymentStreet = o.paymentStreet;
  if (typeof o.paymentStreet2 === "string") d.paymentStreet2 = o.paymentStreet2;
  if (typeof o.paymentCity === "string") d.paymentCity = o.paymentCity;
  if (typeof o.paymentState === "string") d.paymentState = o.paymentState;
  if (typeof o.paymentZip === "string") d.paymentZip = o.paymentZip;
  if (typeof o.contactName === "string") d.contactName = o.contactName;
  if (typeof o.contactEmail === "string") d.contactEmail = o.contactEmail;
  if (typeof o.smtpEnabled === "boolean") d.smtpEnabled = o.smtpEnabled;
  if (typeof o.smtpHost === "string") d.smtpHost = o.smtpHost;
  if (typeof o.smtpPort === "number" && Number.isFinite(o.smtpPort)) d.smtpPort = o.smtpPort;
  else if (typeof o.smtpPort === "string" && o.smtpPort.trim()) d.smtpPort = parseInt(o.smtpPort, 10) || null;
  if (typeof o.gstin === "string") d.gstin = o.gstin;
  if (typeof o.pan === "string") d.pan = o.pan;
  if (typeof o.companyIdentifier === "string") d.companyIdentifier = o.companyIdentifier;
  if (typeof o.financialYearStartMonth === "number" && Number.isFinite(o.financialYearStartMonth)) {
    d.financialYearStartMonth = o.financialYearStartMonth;
  } else if (typeof o.financialYearStartMonth === "string" && o.financialYearStartMonth.trim()) {
    d.financialYearStartMonth = parseInt(o.financialYearStartMonth, 10) || d.financialYearStartMonth;
  }
  if (typeof o.currency === "string") d.currency = o.currency;
  if (typeof o.reportBasis === "string") d.reportBasis = o.reportBasis === "CASH" ? "CASH" : "ACCRUAL";
  if (typeof o.timezone === "string") d.timezone = o.timezone;
  if (typeof o.dateFormat === "string") d.dateFormat = o.dateFormat;
  if (typeof o.organizationLanguage === "string") d.organizationLanguage = o.organizationLanguage;
  if (typeof o.communicationLanguages === "string") d.communicationLanguages = o.communicationLanguages;
  if (typeof o.addressFormatNote === "string") d.addressFormatNote = o.addressFormatNote;
  if (typeof o.prefWeekStartsMonday === "boolean") d.prefWeekStartsMonday = o.prefWeekStartsMonday;
  return d;
}

export async function GET() {
  const session = await requireApiPermission("settings.view");
  if (session instanceof NextResponse) return session;

  const [row, user] = await Promise.all([
    prisma.companyProfile.findUnique({ where: { userId: session.sub } }),
    prisma.user.findUnique({ where: { id: session.sub } }),
  ]);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const organization = row ? companyRowToDTO(row) : defaultOrganizationProfileDTO();
  if (!organization.contactName.trim()) organization.contactName = user.name;
  if (!organization.contactEmail.trim()) organization.contactEmail = user.email;

  const routingEmail = organization.contactEmail.trim() || user.email;
  const publicDomainWarning = isPublicEmailDomain(routingEmail);

  return NextResponse.json({
    organization,
    loginEmail: user.email,
    systemSenderEmail: process.env.NEXT_PUBLIC_SYSTEM_SENDER_EMAIL ?? "notifications@fast.example",
    publicDomainWarning,
  });
}

export async function PUT(request: Request) {
  const session = await requireApiPermission("settings.edit");
  if (session instanceof NextResponse) return session;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = json as {
    organization?: unknown;
    account?: { currentPassword?: string; newPassword?: string };
  };

  const org = pickOrg(body.organization);
  if (!org) return NextResponse.json({ error: "Missing organization" }, { status: 400 });

  const name = org.companyName.trim();
  const country = org.billingCountry.trim();
  const currency = org.currency.trim();
  if (!name) return NextResponse.json({ error: "Organization name is required" }, { status: 400 });
  if (!country) return NextResponse.json({ error: "Country is required" }, { status: 400 });
  if (!currency) return NextResponse.json({ error: "Currency is required" }, { status: 400 });

  const gst = normalizeGstin(org.gstin);
  if (!isValidGstin(gst)) {
    return NextResponse.json({ error: "GSTIN format is invalid for India (15 characters)" }, { status: 400 });
  }
  if (logoPayloadTooLarge(org.logoUrl)) {
    return NextResponse.json({ error: "Logo must be under 1MB" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const account = body.account;
  let newName = user.name;
  if (org.contactName.trim()) {
    newName = org.contactName.trim();
  }

  if (account?.newPassword) {
    const cur = account.currentPassword ?? "";
    const ok = await bcrypt.compare(cur, user.passwordHash);
    if (!ok) return NextResponse.json({ error: "Current password incorrect" }, { status: 400 });
    if (account.newPassword.length < 8) return NextResponse.json({ error: "Password too short" }, { status: 400 });
    const passwordHash = await bcrypt.hash(account.newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, name: newName },
    });
  } else if (newName !== user.name) {
    await prisma.user.update({
      where: { id: user.id },
      data: { name: newName },
    });
  }

  const data = {
    companyName: name,
    logoUrl: org.logoUrl.trim() || null,
    industry: org.industry.trim() || null,
    billingStreet: org.billingStreet.trim() || null,
    billingStreet2: org.billingStreet2.trim() || null,
    billingCity: org.billingCity.trim() || null,
    billingState: org.billingState.trim() || null,
    billingZip: org.billingZip.trim() || null,
    billingCountry: country,
    phone: org.phone.trim() || null,
    fax: org.fax.trim() || null,
    websiteUrl: org.websiteUrl.trim() || null,
    paymentAddressDifferent: org.paymentAddressDifferent,
    paymentStreet: org.paymentStreet.trim() || null,
    paymentStreet2: org.paymentStreet2.trim() || null,
    paymentCity: org.paymentCity.trim() || null,
    paymentState: org.paymentState.trim() || null,
    paymentZip: org.paymentZip.trim() || null,
    contactName: org.contactName.trim() || null,
    contactEmail: org.contactEmail.trim() || null,
    smtpEnabled: org.smtpEnabled,
    smtpHost: org.smtpHost.trim() || null,
    smtpPort: org.smtpPort,
    gstin: gst || null,
    pan: org.pan.trim().toUpperCase() || null,
    companyIdentifier: org.companyIdentifier.trim() || null,
    financialYearStartMonth: org.financialYearStartMonth,
    currency,
    reportBasis: org.reportBasis === "CASH" ? "CASH" : "ACCRUAL",
    timezone: org.timezone.trim() || "Asia/Kolkata",
    dateFormat: org.dateFormat.trim() || "dd/MM/yyyy",
    organizationLanguage: org.organizationLanguage.trim() || "en",
    communicationLanguages: org.communicationLanguages.trim() || "en",
    addressFormatNote: org.addressFormatNote.trim() || null,
    prefWeekStartsMonday: org.prefWeekStartsMonday,
  };

  const row = await prisma.companyProfile.upsert({
    where: { userId: session.sub },
    create: { userId: session.sub, ...data },
    update: data,
  });

  await ensureDefaultCurrencies(prisma, session.sub);
  await alignCurrencyBaseWithCompanyProfile(prisma, session.sub);

  await writeAuditLog(session.sub, "UPDATE", "CompanyProfile", row.id);

  const updatedUser = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!updatedUser) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const permissions = parsePermissionsJson(updatedUser.permissions);
  const token = await signSession({
    sub: updatedUser.id,
    email: updatedUser.email,
    name: updatedUser.name,
    permissions,
  });

  const res = NextResponse.json({ ok: true, message: "Profile updated successfully" });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

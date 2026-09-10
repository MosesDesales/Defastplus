import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { vendorCreateSchema } from "@/lib/validators";

async function assertUserOwnsAccountIds(userId: string, ids: (string | null | undefined)[]) {
  const need = ids.filter((x): x is string => Boolean(x));
  if (need.length === 0) return true;
  const n = await prisma.account.count({ where: { userId, id: { in: need } } });
  return n === need.length;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("search") ?? "").trim().toLowerCase();
  const active = searchParams.get("active");

  const rows = await prisma.vendor.findMany({
    where: {
      userId: session.sub,
      ...(active === "true" ? { isActive: true } : active === "false" ? { isActive: false } : {}),
    },
    orderBy: { displayName: "asc" },
    take: 500,
  });

  let list = rows.map((v) => ({
    id: v.id,
    displayName: v.displayName,
    companyName: v.companyName,
    email: v.email,
    phone: v.mobile || v.workPhone || v.phone,
    gstin: v.gstin,
    currency: v.currency,
    openingBalance: Number(v.openingBalance),
    isActive: v.isActive,
    updatedAt: v.updatedAt.toISOString(),
  }));

  if (q) {
    list = list.filter(
      (v) =>
        v.displayName.toLowerCase().includes(q) ||
        (v.companyName?.toLowerCase().includes(q) ?? false) ||
        (v.email?.toLowerCase().includes(q) ?? false),
    );
  }

  return NextResponse.json({ vendors: list });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = vendorCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  if (!(await assertUserOwnsAccountIds(session.sub, [d.accountsPayableAccountId, d.tdsAccountId]))) {
    return NextResponse.json({ error: "Invalid account selection" }, { status: 400 });
  }

  const phone = d.mobile?.trim() || d.workPhone?.trim() || null;
  const vendor = await prisma.vendor.create({
    data: {
      userId: session.sub,
      displayName: d.displayName.trim(),
      companyName: d.companyName?.trim() ?? null,
      salutation: d.salutation?.trim() ?? null,
      firstName: d.firstName?.trim() ?? null,
      lastName: d.lastName?.trim() ?? null,
      email: d.email?.trim() ?? null,
      phone,
      workPhoneCountryCode: d.workPhoneCountryCode?.trim() || "+91",
      workPhone: d.workPhone?.trim() ?? null,
      mobileCountryCode: d.mobileCountryCode?.trim() || "+91",
      mobile: d.mobile?.trim() ?? null,
      vendorLanguage: d.vendorLanguage?.trim() || "en",
      gstin: d.gstin?.trim() ?? null,
      billingAttention: d.billingAttention?.trim() ?? null,
      billingStreet: d.billingStreet?.trim() ?? null,
      billingCity: d.billingCity?.trim() ?? null,
      billingState: d.billingState?.trim() ?? null,
      billingZip: d.billingZip?.trim() ?? null,
      billingCountry: d.billingCountry?.trim() || "IN",
      pan: d.pan?.trim() ?? null,
      msmeRegistered: d.msmeRegistered ?? false,
      currency: d.currency?.trim() || "INR",
      accountsPayableAccountId: d.accountsPayableAccountId?.trim() || null,
      paymentTerms: d.paymentTerms ?? "DUE_ON_RECEIPT",
      tdsAccountId: d.tdsAccountId?.trim() || null,
      portalEnabled: d.portalEnabled ?? false,
      openingBalance: d.openingBalance ?? 0,
      notes: d.notes?.trim() ?? null,
      isActive: d.isActive ?? true,
    },
  });

  return NextResponse.json({ vendor: { id: vendor.id, displayName: vendor.displayName } }, { status: 201 });
}

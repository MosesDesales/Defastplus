import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { vendorPatchSchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

async function assertUserOwnsAccountIds(userId: string, ids: (string | null | undefined)[]) {
  const need = ids.filter((x): x is string => Boolean(x));
  if (need.length === 0) return true;
  const n = await prisma.account.count({ where: { userId, id: { in: need } } });
  return n === need.length;
}

export async function GET(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const v = await prisma.vendor.findFirst({
    where: { id, userId: session.sub },
  });
  if (!v) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    vendor: {
      id: v.id,
      displayName: v.displayName,
      companyName: v.companyName,
      salutation: v.salutation,
      firstName: v.firstName,
      lastName: v.lastName,
      email: v.email,
      phone: v.phone,
      workPhoneCountryCode: v.workPhoneCountryCode,
      workPhone: v.workPhone,
      mobileCountryCode: v.mobileCountryCode,
      mobile: v.mobile,
      vendorLanguage: v.vendorLanguage,
      gstin: v.gstin,
      billingAttention: v.billingAttention,
      billingStreet: v.billingStreet,
      billingCity: v.billingCity,
      billingState: v.billingState,
      billingZip: v.billingZip,
      billingCountry: v.billingCountry,
      pan: v.pan,
      msmeRegistered: v.msmeRegistered,
      openingBalance: Number(v.openingBalance),
      currency: v.currency,
      accountsPayableAccountId: v.accountsPayableAccountId,
      paymentTerms: v.paymentTerms,
      tdsAccountId: v.tdsAccountId,
      portalEnabled: v.portalEnabled,
      notes: v.notes,
      isActive: v.isActive,
    },
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = vendorPatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.vendor.findFirst({ where: { id, userId: session.sub } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const d = parsed.data;
  if (!(await assertUserOwnsAccountIds(session.sub, [d.accountsPayableAccountId, d.tdsAccountId]))) {
    return NextResponse.json({ error: "Invalid account selection" }, { status: 400 });
  }

  const nextMobile = d.mobile !== undefined ? d.mobile?.trim() ?? null : existing.mobile;
  const nextWork = d.workPhone !== undefined ? d.workPhone?.trim() ?? null : existing.workPhone;
  const derivedPhone =
    d.mobile !== undefined || d.workPhone !== undefined ? nextMobile || nextWork || null : undefined;

  await prisma.vendor.update({
    where: { id },
    data: {
      ...(d.displayName !== undefined ? { displayName: d.displayName.trim() } : {}),
      ...(d.companyName !== undefined ? { companyName: d.companyName?.trim() ?? null } : {}),
      ...(d.salutation !== undefined ? { salutation: d.salutation?.trim() ?? null } : {}),
      ...(d.firstName !== undefined ? { firstName: d.firstName?.trim() ?? null } : {}),
      ...(d.lastName !== undefined ? { lastName: d.lastName?.trim() ?? null } : {}),
      ...(d.email !== undefined ? { email: d.email?.trim() ?? null } : {}),
      ...(d.workPhoneCountryCode !== undefined ? { workPhoneCountryCode: d.workPhoneCountryCode?.trim() || "+91" } : {}),
      ...(d.workPhone !== undefined ? { workPhone: nextWork } : {}),
      ...(d.mobileCountryCode !== undefined ? { mobileCountryCode: d.mobileCountryCode?.trim() || "+91" } : {}),
      ...(d.mobile !== undefined ? { mobile: nextMobile } : {}),
      ...(derivedPhone !== undefined ? { phone: derivedPhone } : {}),
      ...(d.vendorLanguage !== undefined ? { vendorLanguage: d.vendorLanguage?.trim() || "en" } : {}),
      ...(d.gstin !== undefined ? { gstin: d.gstin?.trim() ?? null } : {}),
      ...(d.billingAttention !== undefined ? { billingAttention: d.billingAttention?.trim() ?? null } : {}),
      ...(d.billingStreet !== undefined ? { billingStreet: d.billingStreet?.trim() ?? null } : {}),
      ...(d.billingCity !== undefined ? { billingCity: d.billingCity?.trim() ?? null } : {}),
      ...(d.billingState !== undefined ? { billingState: d.billingState?.trim() ?? null } : {}),
      ...(d.billingZip !== undefined ? { billingZip: d.billingZip?.trim() ?? null } : {}),
      ...(d.billingCountry !== undefined ? { billingCountry: d.billingCountry?.trim() || "IN" } : {}),
      ...(d.pan !== undefined ? { pan: d.pan?.trim() ?? null } : {}),
      ...(d.msmeRegistered !== undefined ? { msmeRegistered: d.msmeRegistered } : {}),
      ...(d.currency !== undefined ? { currency: d.currency?.trim() || "INR" } : {}),
      ...(d.accountsPayableAccountId !== undefined
        ? { accountsPayableAccountId: d.accountsPayableAccountId?.trim() || null }
        : {}),
      ...(d.paymentTerms !== undefined ? { paymentTerms: d.paymentTerms } : {}),
      ...(d.tdsAccountId !== undefined ? { tdsAccountId: d.tdsAccountId?.trim() || null } : {}),
      ...(d.portalEnabled !== undefined ? { portalEnabled: d.portalEnabled } : {}),
      ...(d.openingBalance !== undefined ? { openingBalance: d.openingBalance } : {}),
      ...(d.notes !== undefined ? { notes: d.notes?.trim() ?? null } : {}),
      ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const existing = await prisma.vendor.findFirst({
    where: { id, userId: session.sub },
    include: {
      _count: {
        select: { bills: true, payments: true, purchaseOrders: true, credits: true },
      },
    },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const c = existing._count;
  if (c.bills + c.payments + c.purchaseOrders + c.credits > 0) {
    return NextResponse.json({ error: "Vendor has transactions and cannot be deleted." }, { status: 409 });
  }

  await prisma.vendor.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

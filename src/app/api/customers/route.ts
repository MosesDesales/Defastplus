import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { customerCreateSchema } from "@/lib/validators";
import type { Customer } from "@prisma/client";

function serializeCustomer(c: Customer) {
  return {
    id: c.id,
    userId: c.userId,
    customerType: c.customerType,
    salutation: c.salutation,
    firstName: c.firstName,
    lastName: c.lastName,
    companyName: c.companyName,
    displayName: c.displayName,
    gstin: c.gstin,
    email: c.email,
    workPhoneCountryCode: c.workPhoneCountryCode,
    workPhone: c.workPhone,
    mobileCountryCode: c.mobileCountryCode,
    mobile: c.mobile,
    customerLanguage: c.customerLanguage,
    billingAttention: c.billingAttention,
    billingStreet: c.billingStreet,
    billingCity: c.billingCity,
    billingState: c.billingState,
    billingZip: c.billingZip,
    billingCountry: c.billingCountry,
    pan: c.pan,
    currency: c.currency,
    accountsReceivableAccount: c.accountsReceivableAccount,
    openingBalance: Number(c.openingBalance),
    paymentTerms: c.paymentTerms,
    portalEnabled: c.portalEnabled,
    remarks: c.remarks,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customers = await prisma.customer.findMany({
    where: { userId: session.sub },
    orderBy: { displayName: "asc" },
  });

  return NextResponse.json({
    customers: customers.map(serializeCustomer),
    displayNames: customers.map((c) => c.displayName),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = customerCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const d = parsed.data;

  const customer = await prisma.customer.create({
    data: {
      userId: session.sub,
      customerType: d.customerType,
      salutation: d.salutation?.trim() ? d.salutation.trim() : null,
      firstName: d.firstName?.trim() ? d.firstName.trim() : null,
      lastName: d.lastName?.trim() ? d.lastName.trim() : null,
      companyName: d.companyName?.trim() ? d.companyName.trim() : null,
      displayName: d.displayName.trim(),
      gstin: d.gstin?.trim() ? d.gstin.trim() : null,
      email: d.email ?? null,
      workPhoneCountryCode: d.workPhoneCountryCode.trim(),
      workPhone: d.workPhone?.trim() ? d.workPhone.trim() : null,
      mobileCountryCode: d.mobileCountryCode.trim(),
      mobile: d.mobile?.trim() ? d.mobile.trim() : null,
      customerLanguage: d.customerLanguage.trim(),
      billingAttention: d.billingAttention?.trim() ? d.billingAttention.trim() : null,
      billingStreet: d.billingStreet?.trim() ? d.billingStreet.trim() : null,
      billingCity: d.billingCity?.trim() ? d.billingCity.trim() : null,
      billingState: d.billingState?.trim() ? d.billingState.trim() : null,
      billingZip: d.billingZip?.trim() ? d.billingZip.trim() : null,
      billingCountry: d.billingCountry.trim(),
      pan: d.pan?.trim() ? d.pan.trim() : null,
      currency: d.currency.trim(),
      accountsReceivableAccount: d.accountsReceivableAccount?.trim()
        ? d.accountsReceivableAccount.trim()
        : null,
      openingBalance: d.openingBalance,
      paymentTerms: d.paymentTerms,
      portalEnabled: d.portalEnabled,
      remarks: d.remarks?.trim() ? d.remarks.trim() : null,
    },
  });

  return NextResponse.json({ customer: serializeCustomer(customer) }, { status: 201 });
}

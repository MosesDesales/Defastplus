import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { amountInWords, integerToIndianWords } from "@/lib/amount-in-words";
import { buildInvoicePdfBuffer } from "@/lib/pdf/invoice-pdf";
import type { InvoicePdfPayload } from "@/lib/documents/invoice-pdf-data";

describe("amountInWords (Indian numbering)", () => {
  it("uses lakh and crore", () => {
    assert.equal(integerToIndianWords(149900), "One Lakh Forty-Nine Thousand Nine Hundred");
    assert.equal(integerToIndianWords(12_34_56_789), "Twelve Crore Thirty-Four Lakh Fifty-Six Thousand Seven Hundred Eighty-Nine");
    assert.equal(integerToIndianWords(0), "Zero");
    assert.equal(integerToIndianWords(100_000), "One Lakh");
  });

  it("adds paise and the currency name", () => {
    assert.equal(amountInWords(494118.94), "Indian Rupees Four Lakh Ninety-Four Thousand One Hundred Eighteen and Ninety-Four Paise Only");
    assert.equal(amountInWords(1), "Indian Rupees One Only");
    assert.equal(amountInWords(10.5, "USD"), "US Dollars Ten and Fifty Cents Only");
  });
});

const D = (n: number) => new Prisma.Decimal(n);

function invoice(lineCount: number, status = "SENT"): InvoicePdfPayload {
  const lines = Array.from({ length: lineCount }, (_, i) => ({
    id: `l${i}`, invoiceId: "i", itemId: null, sortOrder: i, description: `Service line ${i + 1}`,
    quantity: D(1), rate: D(1000), taxPercent: D(18), lineNet: D(1000), lineTax: D(180), lineTotal: D(1180),
    lineCgst: D(90), lineSgst: D(90), lineIgst: D(0), item: { hsnCode: "998314", unit: "hrs" },
  }));
  return {
    company: {
      companyName: "Acme Traders", gstin: "33AAACA1234A1Z5", billingStreet: "1 Anna Salai", billingCity: "Chennai",
      billingState: "Tamil Nadu", billingZip: "600002", billingCountry: "IN", logoUrl: null,
    },
    invoice: {
      id: "i", userId: "u", customerId: "c", invoiceNumber: "INV-1", reference: null, issueDate: new Date("2026-10-20"), dueDate: null,
      status, currency: "INR", exchangeRate: null, baseTotal: null, subTotal: D(1000 * lineCount), taxTotal: D(180 * lineCount),
      total: D(1180 * lineCount), discountPercent: D(0), withholdingType: "NONE", withholdingPercent: D(0), adjustmentLabel: "Adjustment",
      adjustmentAmount: D(0), payableTotal: D(1180 * lineCount), quoteId: null, documentTemplateId: null, recurringInvoiceId: null,
      issuanceJournalId: null, createdAt: new Date(), updatedAt: new Date(), lines,
      customer: { displayName: "Buyer Pvt Ltd", gstin: "33AABCB1111B1Z1", billingState: "Tamil Nadu", billingCountry: "IN", paymentTerms: "NET_30" },
    },
  } as unknown as InvoicePdfPayload;
}

const pageCount = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;

describe("invoice PDF", () => {
  it("renders a valid single-page PDF", async () => {
    const pdf = await buildInvoicePdfBuffer(invoice(3));
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    assert.equal(pageCount(pdf), 1);
  });

  it("paginates long invoices", async () => {
    assert.ok(pageCount(await buildInvoicePdfBuffer(invoice(45))) >= 3);
  });

  it("embeds the Inter font (₹ support) rather than Helvetica", async () => {
    const pdf = (await buildInvoicePdfBuffer(invoice(1))).toString("latin1");
    assert.match(pdf, /Inter-Bold/);
  });
});

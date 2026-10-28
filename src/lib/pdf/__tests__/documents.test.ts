import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import {
  billToDocument,
  creditNoteToDocument,
  expenseToDocument,
  quoteToDocument,
  type BillForDoc,
  type CompanyForDocs,
  type CreditNoteForDoc,
  type QuoteForDoc,
} from "@/lib/documents/business-document";
import { buildBusinessDocumentPdf } from "@/lib/pdf/business-document-pdf";
import { buildPayslipPdfBuffer, maskAccount } from "@/lib/pdf/payslip-pdf";
import { buildEWayBillPdf } from "@/lib/pdf/eway-bill-pdf";
import { buildLinesDocumentPdf } from "@/lib/pdf/generic-lines-pdf";

const D = (n: number) => new Prisma.Decimal(n);
const company: CompanyForDocs = {
  companyName: "Acme Traders",
  gstin: "33AAACA1234A1Z5",
  billingStreet: "1 Anna Salai",
  billingCity: "Chennai",
  billingState: "Tamil Nadu",
  billingZip: "600002",
  billingCountry: "IN",
  logoUrl: null,
  bankAccountNumber: "50200012345678",
  bankIfsc: "HDFC0001234",
  bankName: "HDFC Bank",
};
const party = { displayName: "Buyer Pvt Ltd", gstin: "29AABCB1111B1Z1", billingState: "Karnataka", billingCountry: "IN", paymentTerms: "NET_30" };
const isPdf = (b: Buffer) => b.subarray(0, 5).toString() === "%PDF-";

describe("document models", () => {
  it("quote: TDS reduces the total and bank details are included", () => {
    const q = {
      quoteNumber: "QT-1", quoteDate: new Date("2026-10-01"), expiryDate: null, status: "SENT",
      subTotal: D(10000), discountMode: "PERCENT", discountInput: D(10), discountAmount: D(1000),
      withholdingType: "TDS", taxSelectLabel: null, taxAmount: D(90), adjustmentLabel: "Adjustment", adjustmentAmount: D(0), total: D(8910),
      lines: [{ description: "Consulting", quantity: D(1), rate: D(10000), amount: D(10000), item: null }],
      customer: party,
    } as unknown as QuoteForDoc;
    const d = quoteToDocument(q, company, null);
    assert.equal(d.title, "QUOTATION");
    assert.deepEqual(d.totals.map((t) => [t.label, t.value, t.sign]), [
      ["Sub total", 10000, undefined],
      ["Discount (10%)", 1000, "minus"],
      ["TDS", 90, "minus"],
    ]);
    assert.equal(d.total?.value, 8910);
    assert.equal(d.taxMode, "none");
    assert.equal(d.bank?.accountNumber, "50200012345678");
  });

  it("credit note: IGST mode, no bank details, references the invoice", () => {
    const cn = {
      creditNumber: "CN-1", issueDate: new Date("2026-10-02"), status: "OPEN", reason: "Damaged",
      subTotal: D(1000), taxTotal: D(180), total: D(1180), amountApplied: D(0),
      invoice: { invoiceNumber: "INV-9", issueDate: new Date("2026-09-30") },
      lines: [{ description: "Widget", quantity: D(1), rate: D(1000), taxPercent: D(18), lineNet: D(1000), lineTax: D(180), lineTotal: D(1180), lineCgst: D(0), lineSgst: D(0), lineIgst: D(180), item: null }],
      customer: party,
    } as unknown as CreditNoteForDoc;
    const d = creditNoteToDocument(cn, company, null);
    assert.equal(d.taxMode, "igst");
    assert.equal(d.bank, null);
    assert.ok(d.details.some(([k, v]) => k === "Against Invoice" && v.startsWith("INV-9")));
    assert.ok(d.totals.some((t) => t.label === "IGST" && t.value === 180));
  });

  it("bill: supplier party, CGST/SGST split, draft watermark", () => {
    const b = {
      billNumber: "B-1", billDate: new Date("2026-10-03"), dueDate: null, paymentTerms: "NET_15", status: "DRAFT", currency: "INR",
      subTotal: D(2000), taxTotal: D(240), total: D(2240), withholdingType: "NONE", withholdingAmount: D(0), adjustmentAmount: D(0),
      lines: [{ description: "Paper", quantity: D(2), rate: D(1000), taxPercent: D(12), lineNet: D(2000), lineTax: D(240), lineTotal: D(2240), lineCgst: D(120), lineSgst: D(120), lineIgst: D(0), item: { hsnCode: "4802", unit: "ream" } }],
      vendor: { ...party, displayName: "Paper Mills", billingState: "Tamil Nadu", gstin: "33AABCP2222P1Z2" },
    } as unknown as BillForDoc;
    const d = billToDocument(b, company, null);
    assert.equal(d.party?.label, "Supplier");
    assert.equal(d.taxMode, "split");
    assert.equal(d.watermark, "DRAFT");
    assert.equal(d.lines[0]!.unit, "ream");
  });

  it("expense: shows tax without inventing a GST rate", () => {
    const d = expenseToDocument(
      {
        id: "abc123xyz", expenseDate: new Date("2026-07-07"), invoiceNumber: null, amount: D(1999), taxAmount: D(5), notes: null, journalEntryId: "j1",
        expenseAccount: { code: "5000", name: "General Purchases" }, bankAccount: { code: "1010", name: "Bank" }, vendor: null,
      },
      company,
    );
    assert.equal(d.lines[0]!.taxPercent, 0);
    assert.equal(d.total?.value, 2004);
  });

  it("expense without a vendor still renders (no PDF subject)", async () => {
    const d = expenseToDocument(
      {
        id: "novendor1", expenseDate: new Date("2026-07-07"), invoiceNumber: null, amount: D(100), taxAmount: D(0), notes: null, journalEntryId: null,
        expenseAccount: { code: "5000", name: "Office" }, bankAccount: { code: "1010", name: "Bank" }, vendor: null,
      },
      company,
    );
    assert.equal(d.party, null);
    assert.ok(isPdf(await buildBusinessDocumentPdf(d)));
  });
});

describe("PDF builders", () => {
  it("renders quote, payslip, e-way bill and report PDFs", async () => {
    const q = quoteToDocument(
      {
        quoteNumber: "QT-2", quoteDate: new Date(), expiryDate: null, status: "DRAFT", subTotal: D(500), discountMode: "PERCENT", discountInput: D(0),
        discountAmount: D(0), withholdingType: "NONE", taxSelectLabel: null, taxAmount: D(0), adjustmentLabel: "Adjustment", adjustmentAmount: D(0), total: D(500),
        lines: [{ description: "Item", quantity: D(1), rate: D(500), amount: D(500), item: null }], customer: party,
      } as unknown as QuoteForDoc,
      company,
      null,
    );
    assert.ok(isPdf(await buildBusinessDocumentPdf(q)));

    const payslip = await buildPayslipPdfBuffer({
      company: { ...company },
      employee: { displayName: "Priya", employeeNumber: "EMP-1", department: null, designation: null, dateOfJoining: null, bankAccountName: null, bankIfsc: null, bankAccountNo: "1234567890", pan: null },
      yearMonth: "2026-08", daysPaid: 30, earnings: [{ name: "Basic", amount: 50000 }], deductions: [{ name: "PF", amount: 6000 }],
      gross: 50000, totalDeductions: 6000, netPay: 44000, leaveLines: [{ name: "Casual", alloted: 12, availed: 1, takenYtd: 3, balance: 9 }],
    });
    assert.ok(isPdf(payslip));

    const eway = await buildEWayBillPdf(
      {
        status: "GENERATED", documentType: "TAX_INVOICE", sourceDocumentNumber: "INV-1", sourceDocumentDate: new Date(), documentValue: D(100000),
        ewayBillNumber: "123412341234", generatedAt: new Date(), validUntil: new Date(), qrCodeData: null, apiAckNo: null,
        supplierName: "Acme", supplierGstin: "33AAACA1234A1Z5", supplierAddress: null, supplierStateCode: "33", supplierPincode: "600002",
        recipientName: "Buyer", recipientGstin: null, recipientAddress: null, recipientStateCode: "29", recipientPincode: "560001",
        transporterName: null, transporterGstin: null, transportMode: "ROAD", vehicleNumber: "TN01AB1234", vehicleType: "REGULAR", distanceKm: 350,
        placeOfSupply: "29", supplyType: "O", subSupplyType: null, transactionType: "Regular", errorMessage: null,
        lines: [{ productName: "Widget", hsnCode: "8471", quantity: D(10), unit: "NOS", taxableValue: D(100000), cgstRate: D(0), sgstRate: D(0), igstRate: D(18), cessRate: D(0) }],
      } as never,
      company,
    );
    assert.ok(isPdf(eway));

    const report = await buildLinesDocumentPdf({ title: "Report", meta: [["From", "2026-04-01"]], columns: ["Doc", "Value"], rows: [["INV-1", 1000]], company });
    assert.ok(isPdf(report));
  });

  it("masks payslip bank account numbers", () => {
    assert.equal(maskAccount("50200012345678"), "••••••••5678");
    assert.equal(maskAccount(null), "—");
    assert.equal(maskAccount("123"), "123");
  });
});

/**
 * OCR test suite — Indian GST invoice samples.
 * Run: npx tsx --test src/lib/ocr/__tests__/indian-gst.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFieldConfidence } from "@/lib/ocr/field-confidence";
import { validateGstinChecksum, validateGstinFull, applyGstValidations } from "@/lib/ocr/gst-validation";
import { extractIndianGstDocument } from "@/lib/ocr/indian-gst-extract";
import { validateAndReconcileExtraction } from "@/lib/ocr/validate-extraction";

const CURSOR_USD = `
Invoice
Invoice number OADNI499-0002
Date of issue May 28, 2026
Cursor
Description Qty Unit price Tax Amount
Cursor Ultra 1 $200.00 18% $236.00
Subtotal $200.00
GST - India (18%) $36.00
Total $236.00 USD
Amount due $236.00 USD
`;

const INDIAN_GST_SAMPLE = `
TAX INVOICE
Supplier: Acme Traders Pvt Ltd
GSTIN: 27AAPFU0939F1ZV
Invoice No: INV/2026/0042
Invoice Date: 15-03-2026
Due Date: 30-03-2026
Place of Supply: Maharashtra
PO No: PO-7781

Description HSN Qty Rate Amount
Widget Pro 847130 2 5000.00 10000.00
Service Fee 998314 1 2000.00 2000.00

Taxable Value 12000.00
CGST @ 9% 1080.00
SGST @ 9% 1080.00
Sub Total 12000.00
Grand Total 14160.00
`;

describe("Indian GST OCR extraction", () => {
  it("extracts USD SaaS invoice total correctly", () => {
    const doc = validateAndReconcileExtraction(extractIndianGstDocument(CURSOR_USD, "BILL", null));
    assert.equal(doc.total, 236);
    assert.equal(doc.partyName, "Cursor");
  });

  it("extracts Indian GST invoice fields", () => {
    const doc = extractIndianGstDocument(INDIAN_GST_SAMPLE, "BILL", "29AAPFU0939F1ZR");
    assert.equal(doc.partyGstin, "27AAPFU0939F1ZV");
    assert.equal(doc.invoiceNo, "INV/2026/0042");
    assert.equal(doc.invoiceDate, "2026-03-15");
    assert.equal(doc.dueDate, "2026-03-30");
    assert.equal(doc.purchaseOrderNo, "PO-7781");
    assert.ok(doc.items.length >= 1);
    assert.equal(doc.cgst, 1080);
    assert.equal(doc.sgst, 1080);
    assert.equal(doc.total, 14160);
    assert.equal(doc.supplyIsInterState, true);
  });

  it("validates GSTIN checksum for known sample", () => {
    assert.equal(validateGstinFull("27AAPFU0939F1ZV").valid, true);
    assert.equal(validateGstinChecksum("27AAPFU0939F1ZV"), true);
  });

  it("flags CGST/SGST mismatch", () => {
    const doc = applyGstValidations({
      items: [],
      warnings: [],
      cgst: 100,
      sgst: 50,
      total: 150,
    });
    assert.ok(doc.warnings.some((w) => w.includes("CGST")));
  });

  it("assigns field confidence scores", () => {
    const doc = extractIndianGstDocument(INDIAN_GST_SAMPLE, "BILL", null);
    const fc = buildFieldConfidence(doc, 0.8, { gstinValid: true });
    assert.ok((fc.partyGstin ?? 0) > 0.7);
    assert.ok((fc.total ?? 0) > 0.5);
  });
});

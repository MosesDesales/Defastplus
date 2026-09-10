import type { EWayBill, EWayBillLine, Customer } from "@prisma/client";
import { pdfBufferFromDoc } from "@/lib/pdf/simple-pdf";
import { fmtMoney } from "@/lib/documents/invoice-pdf-data";
import { EWAY_DOCUMENT_TYPE_LABELS, EWAY_STATUS_LABELS, EWAY_TRANSPORT_MODE_LABELS } from "@/lib/eway/constants";

type BillWithLines = EWayBill & {
  lines: EWayBillLine[];
  customer?: Pick<Customer, "displayName"> | null;
};

export async function buildEWayBillPdf(bill: BillWithLines): Promise<Buffer> {
  return pdfBufferFromDoc((doc) => {
    doc.fontSize(18).text("E-Way Bill", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#444").text("Generated via FAST Accounting", { align: "center" }).fillColor("#000");
    doc.moveDown();

    doc.fontSize(12).text(`EBN: ${bill.ewayBillNumber ?? "— (not generated)"}`);
    doc.fontSize(9).text(`Status: ${EWAY_STATUS_LABELS[bill.status]}`);
    if (bill.validUntil) doc.text(`Valid until: ${bill.validUntil.toLocaleString("en-IN")}`);
    doc.moveDown();

    doc.fontSize(11).text("Document", { underline: true });
    doc.fontSize(9);
    doc.text(`Type: ${EWAY_DOCUMENT_TYPE_LABELS[bill.documentType]}`);
    doc.text(`Number: ${bill.sourceDocumentNumber}`);
    doc.text(`Date: ${bill.sourceDocumentDate.toLocaleDateString("en-IN")}`);
    doc.text(`Value: ${fmtMoney(Number(bill.documentValue))}`);
    doc.moveDown();

    doc.fontSize(11).text("Consignor (Supplier)", { underline: true });
    doc.fontSize(9);
    doc.text(bill.supplierName);
    if (bill.supplierGstin) doc.text(`GSTIN: ${bill.supplierGstin}`);
    if (bill.supplierAddress) doc.text(bill.supplierAddress);
    doc.text(`State: ${bill.supplierStateCode ?? "—"} · Pin: ${bill.supplierPincode ?? "—"}`);
    doc.moveDown();

    doc.fontSize(11).text("Consignee (Recipient)", { underline: true });
    doc.fontSize(9);
    doc.text(bill.recipientName);
    if (bill.recipientGstin) doc.text(`GSTIN: ${bill.recipientGstin}`);
    if (bill.recipientAddress) doc.text(bill.recipientAddress);
    doc.text(`State: ${bill.recipientStateCode ?? "—"} · Pin: ${bill.recipientPincode ?? "—"}`);
    doc.moveDown();

    doc.fontSize(11).text("Transport", { underline: true });
    doc.fontSize(9);
    doc.text(`Mode: ${EWAY_TRANSPORT_MODE_LABELS[bill.transportMode]}`);
    doc.text(`Vehicle: ${bill.vehicleNumber ?? "—"}`);
    doc.text(`Distance: ${bill.distanceKm ?? "—"} km`);
    if (bill.transporterName) doc.text(`Transporter: ${bill.transporterName}`);
    if (bill.transporterGstin) doc.text(`Transporter GSTIN: ${bill.transporterGstin}`);
    doc.moveDown();

    doc.fontSize(11).text("Items", { underline: true });
    doc.fontSize(8);
    let y = doc.y + 4;
    const headers = ["Product", "HSN", "Qty", "Taxable"];
    const widths = [220, 60, 50, 80];
    let x = 50;
    headers.forEach((h, i) => {
      doc.text(h, x, y, { width: widths[i], continued: i < headers.length - 1 });
      x += widths[i]!;
    });
    y += 14;
    for (const line of bill.lines) {
      x = 50;
      const cells = [
        line.productName.slice(0, 60),
        line.hsnCode ?? "—",
        `${Number(line.quantity)} ${line.unit}`,
        fmtMoney(Number(line.taxableValue)),
      ];
      cells.forEach((c, i) => {
        doc.text(c, x, y, { width: widths[i], continued: i < cells.length - 1 });
        x += widths[i]!;
      });
      y += 14;
    }

    if (bill.qrCodeData) {
      doc.addPage();
      doc.fontSize(12).text("QR / Verification data", { underline: true });
      doc.fontSize(8).text(bill.qrCodeData, { width: 480 });
    }
  });
}

import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireApiPermission } from "@/lib/api-auth";
import { listEWayBills } from "@/lib/eway/service";
import { EWAY_STATUS_LABELS, EWAY_DOCUMENT_TYPE_LABELS } from "@/lib/eway/constants";
import { buildLinesDocumentPdf } from "@/lib/pdf/generic-lines-pdf";
import type { EWayBillStatus } from "@prisma/client";

/** GET /api/gst/eway-bills/reports?type=summary&format=csv|xlsx|pdf */
export async function GET(request: Request) {
  const session = await requireApiPermission("gst.view");
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "generated";
  const format = searchParams.get("format") ?? "json";
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  const statusFilter: EWayBillStatus[] | undefined =
    type === "expired"
      ? ["EXPIRED"]
      : type === "cancelled"
        ? ["CANCELLED"]
        : type === "vehicle_updates"
          ? undefined
          : ["GENERATED", "IN_TRANSIT", "EXPIRED"];

  const rows = await listEWayBills(session.sub, { from, to, status: statusFilter?.[0] }, 5000);

  const filtered =
    type === "generated"
      ? rows.filter((r) => ["GENERATED", "IN_TRANSIT"].includes(r.status))
      : type === "expired"
        ? rows.filter((r) => r.status === "EXPIRED")
        : type === "cancelled"
          ? rows.filter((r) => r.status === "CANCELLED")
          : rows;

  const tableRows = filtered.map((r) => [
    r.ewayBillNumber ?? "—",
    EWAY_STATUS_LABELS[r.status],
    EWAY_DOCUMENT_TYPE_LABELS[r.documentType],
    r.sourceDocumentNumber,
    r.sourceDocumentDate.toISOString().slice(0, 10),
    Number(r.documentValue),
    r.recipientName,
    r.recipientGstin ?? "",
    r.recipientStateCode ?? "",
    r.vehicleNumber ?? "",
    r.generatedAt?.toISOString().slice(0, 16) ?? "",
    r.validUntil?.toISOString().slice(0, 16) ?? "",
  ]);

  const columns = [
    "EBN",
    "Status",
    "Doc Type",
    "Doc No",
    "Doc Date",
    "Value",
    "Customer",
    "GSTIN",
    "State",
    "Vehicle",
    "Generated",
    "Valid Until",
  ];

  if (format === "json") {
    const byCustomer: Record<string, { count: number; value: number }> = {};
    const byState: Record<string, { count: number; value: number }> = {};
    for (const r of filtered) {
      const ck = r.recipientName;
      byCustomer[ck] = byCustomer[ck] ?? { count: 0, value: 0 };
      byCustomer[ck]!.count += 1;
      byCustomer[ck]!.value += Number(r.documentValue);
      const sk = r.recipientStateCode ?? "—";
      byState[sk] = byState[sk] ?? { count: 0, value: 0 };
      byState[sk]!.count += 1;
      byState[sk]!.value += Number(r.documentValue);
    }
    return NextResponse.json({ type, count: filtered.length, byCustomer, byState, items: filtered });
  }

  if (format === "csv") {
    const csv = [columns.join(","), ...tableRows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join(
      "\n",
    );
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="eway-${type}.csv"`,
      },
    });
  }

  if (format === "xlsx") {
    const ws = XLSX.utils.aoa_to_sheet([columns, ...tableRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "EWayBills");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="eway-${type}.xlsx"`,
      },
    });
  }

  if (format === "pdf") {
    const pdf = await buildLinesDocumentPdf({
      title: `E-Way Bill Report — ${type}`,
      meta: [
        ["From", from ?? "—"],
        ["To", to ?? "—"],
        ["Records", String(filtered.length)],
      ],
      columns,
      rows: tableRows,
    });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="eway-${type}.pdf"`,
      },
    });
  }

  return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
}

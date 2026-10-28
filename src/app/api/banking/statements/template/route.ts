import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

/** GET — a ready-to-fill Excel statement template whose headings are auto-detected on upload. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = [
    ["Date", "Description", "Reference", "Debit", "Credit", "Balance"],
    ["01/04/2026", "Opening balance", "", "", "", 100000],
    ["02/04/2026", "UPI payment to supplier", "UPI123456", 2500, "", 97500],
    ["03/04/2026", "NEFT received from customer", "NEFT98765", "", 18000, 115500],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 12 }, { wch: 36 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Statement");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="bank-statement-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}

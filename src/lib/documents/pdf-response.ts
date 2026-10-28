import { NextResponse } from "next/server";

export function pdfResponse(buf: Buffer, filename: string) {
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename.replace(/["\\\r\n]/g, "_")}"`,
    },
  });
}

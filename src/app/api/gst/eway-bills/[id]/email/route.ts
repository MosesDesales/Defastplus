import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/api-auth";
import { getEWayBill } from "@/lib/eway/service";
import { buildEWayBillPdf } from "@/lib/pdf/eway-bill-pdf";

const schema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(500).optional(),
  text: z.string().min(1).max(5000).optional(),
});

/** POST /api/gst/eway-bills/[id]/email */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiPermission("gst.edit");
  if (session instanceof NextResponse) return session;

  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    return NextResponse.json({ error: "Email not configured (SMTP_HOST)." }, { status: 503 });
  }

  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const bill = await getEWayBill(session.sub, id);
  if (!bill) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pdf = await buildEWayBillPdf(bill);
  const ebn = bill.ewayBillNumber ?? "draft";
  const subject = parsed.data.subject ?? `E-Way Bill ${ebn} — ${bill.sourceDocumentNumber}`;
  const text =
    parsed.data.text ??
    `Please find attached E-Way Bill for document ${bill.sourceDocumentNumber}.\n\nEBN: ${ebn}`;

  const from = process.env.EMAIL_FROM?.trim() || process.env.SMTP_USER?.trim();
  if (!from) return NextResponse.json({ error: "EMAIL_FROM required" }, { status: 503 });

  const port = Number(process.env.SMTP_PORT || "587");
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });

  await transporter.sendMail({
    from,
    to: parsed.data.to,
    subject,
    text,
    attachments: [{ filename: `eway-${ebn}.pdf`, content: pdf }],
  });

  return NextResponse.json({ ok: true });
}

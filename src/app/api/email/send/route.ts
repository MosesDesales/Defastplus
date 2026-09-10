import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildAttachmentPdf, type AttachmentKind } from "@/lib/email/attachment-pdf";
import { getSession } from "@/lib/session";

const bodySchema = z.object({
  to: z.string().trim().email(),
  subject: z.string().trim().min(1).max(500),
  text: z.string().trim().min(1).max(20_000),
  attachment: z
    .object({
      kind: z.enum(["invoice", "quote", "bill", "expense", "credit-note", "payslip"]),
      id: z.string().min(1),
    })
    .optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    return NextResponse.json(
      { error: "Email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and EMAIL_FROM in the environment." },
      { status: 503 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { to, subject, text, attachment } = parsed.data;
  const from = process.env.EMAIL_FROM?.trim() || process.env.SMTP_USER?.trim();
  if (!from) {
    return NextResponse.json({ error: "EMAIL_FROM or SMTP_USER must be set." }, { status: 503 });
  }

  let pdfPart: { filename: string; buffer: Buffer } | undefined;
  if (attachment) {
    const built = await buildAttachmentPdf(session.sub, attachment.kind as AttachmentKind, attachment.id);
    if (!built) return NextResponse.json({ error: "Attachment document not found" }, { status: 404 });
    pdfPart = built;
  }

  const port = Number(process.env.SMTP_PORT || "587");
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });

  try {
    await transporter.sendMail({
      from,
      to,
      subject,
      text,
      attachments: pdfPart ? [{ filename: pdfPart.filename, content: pdfPart.buffer }] : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not send email. Check SMTP settings." }, { status: 500 });
  }
}

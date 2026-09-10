import nodemailer from "nodemailer";

/** Shared SMTP transporter for server-side email sends. Returns null if SMTP isn't configured. */
export function createMailTransport() {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT || "587");
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
}

export function getFromAddress(): string | null {
  return process.env.EMAIL_FROM?.trim() || process.env.SMTP_USER?.trim() || null;
}

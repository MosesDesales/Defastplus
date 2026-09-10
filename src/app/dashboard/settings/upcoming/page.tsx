import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

const LABELS: Record<string, { title: string; body: string }> = {
  "custom-domain": {
    title: "Custom domain",
    body: "Map your own domain to FAST and serve the app and customer-facing pages from your brand URL.",
  },
  locations: {
    title: "Locations",
    body: "Manage branches, warehouses, and tax registrations across locations from one workspace.",
  },
  "ai-preferences": {
    title: "AI preferences",
    body: "Control how AI-assisted features (OCR, suggestions, drafts) use your organization data.",
  },
  subscription: {
    title: "Manage subscription",
    body: "View plan, usage, billing, and upgrade options for your organization.",
  },
  "msme-settings": {
    title: "MSME settings",
    body: "Capture Udyam / MSME classification for filings and vendor compliance.",
  },
  "opening-balances": {
    title: "Opening balances",
    body: "Post opening balances and map legacy balances into the chart of accounts.",
  },
  reminders: {
    title: "Reminders",
    body: "Email and in-app reminders for dues, approvals, and recurring documents.",
  },
  "customer-portal": {
    title: "Customer portal",
    body: "Let customers view invoices, pay online, and download statements from a branded portal.",
  },
  "vendor-portal": {
    title: "Vendor portal",
    body: "Give vendors a secure space to submit bills and track payment status.",
  },
  "txn-number-series": {
    title: "Transaction number series",
    body: "Define prefixes, sequences, and reset rules for invoices, bills, and journals.",
  },
  "email-notifications": {
    title: "Email notifications",
    body: "Choose which events trigger email to your team and customers.",
  },
  "sms-notifications": {
    title: "SMS notifications",
    body: "SMS alerts for payments, OTPs, and critical approvals.",
  },
  "reporting-tags": {
    title: "Reporting tags",
    body: "Tag transactions for dimensions, projects, and management reporting.",
  },
  "web-tabs": {
    title: "Web tabs",
    body: "Embed external tools and reports as tabs inside FAST.",
  },
  "digital-signature": {
    title: "Digital signature",
    body: "Apply compliant signatures to PDFs and outbound documents.",
  },
  "workflow-rules": {
    title: "Workflow rules",
    body: "Define conditions that start automations when records change.",
  },
  "workflow-actions": {
    title: "Workflow actions",
    body: "Configure actions such as email, field updates, and webhooks.",
  },
  "workflow-logs": {
    title: "Workflow logs",
    body: "Audit trail of automation runs and failures.",
  },
  schedules: {
    title: "Schedules",
    body: "Time-based jobs for recurring invoices, bills, and reminders.",
  },
  "custom-modules": {
    title: "Custom modules",
    body: "Extend FAST with custom objects, fields, and screens.",
  },
  "find-accountants": {
    title: "Find accountants",
    body: "Partner directory and assisted onboarding are not enabled in this build. Export your books or invite your firm as a user with appropriate roles.",
  },
  "reverse-charge-help": {
    title: "Reverse charge",
    body: "When reverse charge applies, your customer may be liable to pay GST on your supply. Record RCM lines and ITC per your advisor and GST law.",
  },
};

type Props = { searchParams: Promise<{ k?: string }> };

export default async function UpcomingSettingsPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { k } = await searchParams;
  const raw = typeof k === "string" ? k : "";
  const meta =
    LABELS[raw] ?? {
      title: "Coming soon",
      body: "This settings area is on the roadmap. Use the header Settings menu or sidebar to reach features that are already live.",
    };

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase text-teal-600 dark:text-teal-400">Settings</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{meta.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{meta.body}</p>
      </div>
      <div className="flex flex-wrap gap-3 pt-2">
        <Link
          href="/settings/profile"
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
        >
          Company & profile
        </Link>
        <Link href="/dashboard/settings" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">
          All settings
        </Link>
      </div>
    </div>
  );
}

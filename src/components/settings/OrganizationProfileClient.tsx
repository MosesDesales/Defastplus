"use client";

import { HelpCircle, Loader2, Upload } from "lucide-react";
import Link from "next/link";
import { startTransition, useCallback, useEffect, useId, useRef, useState } from "react";
import { CurrencySelect } from "@/components/settings/CurrencySelect";
import { parseResponseJson } from "@/lib/parse-response-json";
import { isPublicEmailDomain } from "@/lib/email-public-domain";
import { isValidGstin, normalizeGstin } from "@/lib/gstin";
import {
  COUNTRIES,
  DATE_FORMATS,
  FISCAL_START_MONTHS,
  INDIAN_STATES,
  INDUSTRIES,
  TIMEZONES,
  UI_LANGUAGES,
} from "@/lib/org-profile-constants";
import { defaultOrganizationProfileDTO, type OrganizationProfileDTO } from "@/lib/organization-profile-dto";

const inputBase =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-teal-600/10 focus:border-teal-600 focus:ring-4 dark:border-slate-700 dark:bg-slate-950 dark:text-white";
const labelBase = "block text-sm font-medium text-slate-700 dark:text-slate-300";
const req = "text-red-600 dark:text-red-400";

function Tooltip({ text }: { text: string }) {
  return (
    <span className="ml-1 inline-flex align-middle" title={text}>
      <HelpCircle className="h-4 w-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" aria-hidden />
      <span className="sr-only">{text}</span>
    </span>
  );
}

function Card({
  id,
  title,
  subtitle,
  children,
}: Readonly<{
  id?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}>) {
  return (
    <section
      id={id}
      className="scroll-mt-28 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function OrganizationProfileClient() {
  const formId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [org, setOrg] = useState<OrganizationProfileDTO>(() => defaultOrganizationProfileDTO());
  const [loginEmail, setLoginEmail] = useState("");
  const [systemSenderEmail, setSystemSenderEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; message: string } | null>(null);
  const [gstHint, setGstHint] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [showAddressFormat, setShowAddressFormat] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/settings/profile", { credentials: "include" });
    const data = await parseResponseJson<{
      organization?: OrganizationProfileDTO;
      loginEmail?: string;
      systemSenderEmail?: string;
      publicDomainWarning?: boolean;
    }>(res, {});
    if (res.ok && data.organization) {
      setOrg({ ...defaultOrganizationProfileDTO(), ...data.organization });
      setLoginEmail(data.loginEmail ?? "");
      setSystemSenderEmail(data.systemSenderEmail ?? "");
      if (data.organization.logoUrl?.startsWith("data:") || data.organization.logoUrl?.startsWith("http")) {
        setLogoPreview(data.organization.logoUrl);
      } else {
        setLogoPreview(null);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    startTransition(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const routingEmail = org.contactEmail.trim() || loginEmail;
  const showPublicEmailBanner = isPublicEmailDomain(routingEmail);

  function set<K extends keyof OrganizationProfileDTO>(key: K, value: OrganizationProfileDTO[K]) {
    setOrg((o) => ({ ...o, [key]: value }));
  }

  function applyDetectedTimezone() {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) set("timezone", tz);
    } catch {
      set("timezone", "Asia/Kolkata");
    }
  }

  async function onLogoFile(f: File | null) {
    if (!f) return;
    if (!/^image\/(jpeg|jpg|png)$/i.test(f.type)) {
      setToast({ type: "err", message: "Logo must be JPG or PNG." });
      return;
    }
    if (f.size > 1024 * 1024) {
      setToast({ type: "err", message: "Logo must be under 1MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      if (typeof r === "string") {
        setLogoPreview(r);
        set("logoUrl", r);
      }
    };
    reader.readAsDataURL(f);
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    const name = org.companyName.trim();
    const country = org.billingCountry.trim();
    const currency = org.currency.trim();
    if (!name) {
      setToast({ type: "err", message: "Organization name is required." });
      return;
    }
    if (!country) {
      setToast({ type: "err", message: "Country is required." });
      return;
    }
    if (!currency) {
      setToast({ type: "err", message: "Currency is required." });
      return;
    }
    const gst = normalizeGstin(org.gstin);
    if (!isValidGstin(gst)) {
      setGstHint("Enter a valid 15-character GSTIN, or leave blank.");
      setToast({ type: "err", message: "GSTIN format is invalid." });
      return;
    }
    setGstHint(null);
    setSaving(true);
    const body: Record<string, unknown> = {
      organization: { ...org, companyName: name, billingCountry: country, currency, gstin: gst },
    };
    if (newPassword.trim()) {
      body.account = { currentPassword: currentPassword.trim(), newPassword: newPassword.trim() };
    }
    const res = await fetch("/api/settings/profile", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await parseResponseJson<{ message?: string; error?: string }>(res, {});
    setSaving(false);
    if (!res.ok) {
      setToast({ type: "err", message: data.error ?? "Could not save profile." });
      return;
    }
    setToast({ type: "ok", message: data.message ?? "Profile updated successfully" });
    setCurrentPassword("");
    setNewPassword("");
    await load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 dark:text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
      </div>
    );
  }

  return (
    <div className="relative pb-28">
      {toast ? (
        <div
          role="status"
          className={`fixed left-1/2 top-20 z-[70] w-[min(calc(100%-2rem),28rem)] -translate-x-1/2 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg ${
            toast.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
              : "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      <form id={formId} onSubmit={save} className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">Settings</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Organization Profile</h1>
              {org.id ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  ID: {org.id.slice(0, 12)}…
                </span>
              ) : (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  Not saved yet
                </span>
              )}
            </div>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
              Company identity, address, regional defaults, and contact details used on documents and GST views.
            </p>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-60 dark:bg-teal-600 dark:hover:bg-teal-500"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Save
          </button>
        </div>

        {/* 1. Organization details */}
        <Card
          id="settings-branding"
          title="Organization details"
          subtitle="Logo and legal name appear on PDFs and customer emails."
        >
          <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
            <div>
              <p className={`${labelBase}`}>Organization logo</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Max 1MB · JPG or PNG</p>
              <div className="mt-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  className="sr-only"
                  onChange={(e) => void onLogoFile(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex aspect-square w-full max-w-[200px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-600 transition hover:border-teal-400 hover:bg-teal-50/50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-400 dark:hover:border-teal-600"
                >
                  {logoPreview || org.logoUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element -- data URLs / arbitrary logo URLs */}
                      <img
                        src={logoPreview || org.logoUrl}
                        alt="Logo preview"
                        className="max-h-36 max-w-full rounded-lg object-contain p-1"
                      />
                    </>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-slate-400" aria-hidden />
                      <span>Upload your organization logo</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className={labelBase}>
                  <span className={req}>*</span> Organization name
                </span>
                <input
                  required
                  value={org.companyName}
                  onChange={(e) => set("companyName", e.target.value)}
                  className={inputBase}
                  placeholder="Your company legal name"
                />
              </label>
              <label>
                <span className={labelBase}>
                  <span className={req}>*</span> Industry
                  <Tooltip text="Used for reporting segments and defaults." />
                </span>
                <select
                  required
                  value={org.industry}
                  onChange={(e) => set("industry", e.target.value)}
                  className={inputBase}
                >
                  <option value="">Select industry</option>
                  {INDUSTRIES.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className={labelBase}>
                  <span className={req}>*</span> Organization location
                  <Tooltip text="Country of registration / tax residence." />
                </span>
                <select
                  required
                  value={org.billingCountry}
                  onChange={(e) => set("billingCountry", e.target.value)}
                  className={inputBase}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </Card>

        {/* 2. Address */}
        <Card title="Address information" subtitle="Shown on invoices, bills, and tax documents.">
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={showAddressFormat}
                onChange={(e) => setShowAddressFormat(e.target.checked)}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-600"
              />
              Show address format note
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={org.paymentAddressDifferent}
                onChange={(e) => set("paymentAddressDifferent", e.target.checked)}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-600"
              />
              Use different address for payment stubs
            </label>
          </div>
          {showAddressFormat ? (
            <label className="mb-4 block">
              <span className={labelBase}>Address format note</span>
              <textarea
                value={org.addressFormatNote}
                onChange={(e) => set("addressFormatNote", e.target.value)}
                rows={2}
                className={inputBase}
                placeholder="Optional instructions for how the address should print."
              />
            </label>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className={labelBase}>Address line 1</span>
              <input value={org.billingStreet} onChange={(e) => set("billingStreet", e.target.value)} className={inputBase} />
            </label>
            <label className="sm:col-span-2">
              <span className={labelBase}>Address line 2</span>
              <input value={org.billingStreet2} onChange={(e) => set("billingStreet2", e.target.value)} className={inputBase} />
            </label>
            <label>
              <span className={labelBase}>City</span>
              <input value={org.billingCity} onChange={(e) => set("billingCity", e.target.value)} className={inputBase} />
            </label>
            <label>
              <span className={labelBase}>Pincode</span>
              <input value={org.billingZip} onChange={(e) => set("billingZip", e.target.value)} className={inputBase} />
            </label>
            <label>
              <span className={labelBase}>State</span>
              {org.billingCountry === "IN" ? (
                <select
                  value={org.billingState}
                  onChange={(e) => set("billingState", e.target.value)}
                  className={inputBase}
                >
                  <option value="">Select state</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s.code} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input value={org.billingState} onChange={(e) => set("billingState", e.target.value)} className={inputBase} />
              )}
            </label>
            <label>
              <span className={labelBase}>Phone</span>
              <input type="tel" value={org.phone} onChange={(e) => set("phone", e.target.value)} className={inputBase} />
            </label>
            <label className="sm:col-span-2">
              <span className={labelBase}>Fax</span>
              <input value={org.fax} onChange={(e) => set("fax", e.target.value)} className={inputBase} />
            </label>
            <label className="sm:col-span-2">
              <span className={labelBase}>Website URL</span>
              <input
                value={org.websiteUrl}
                onChange={(e) => set("websiteUrl", e.target.value)}
                className={inputBase}
                placeholder="https://"
              />
            </label>
          </div>

          {org.paymentAddressDifferent ? (
            <div className="mt-6 border-t border-slate-100 pt-6 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Payment stub address</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className={labelBase}>Street 1</span>
                  <input value={org.paymentStreet} onChange={(e) => set("paymentStreet", e.target.value)} className={inputBase} />
                </label>
                <label className="sm:col-span-2">
                  <span className={labelBase}>Street 2</span>
                  <input value={org.paymentStreet2} onChange={(e) => set("paymentStreet2", e.target.value)} className={inputBase} />
                </label>
                <label>
                  <span className={labelBase}>City</span>
                  <input value={org.paymentCity} onChange={(e) => set("paymentCity", e.target.value)} className={inputBase} />
                </label>
                <label>
                  <span className={labelBase}>Pincode</span>
                  <input value={org.paymentZip} onChange={(e) => set("paymentZip", e.target.value)} className={inputBase} />
                </label>
                <label className="sm:col-span-2">
                  <span className={labelBase}>State</span>
                  {org.billingCountry === "IN" ? (
                    <select
                      value={org.paymentState}
                      onChange={(e) => set("paymentState", e.target.value)}
                      className={inputBase}
                    >
                      <option value="">Select state</option>
                      {INDIAN_STATES.map((s) => (
                        <option key={s.code} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input value={org.paymentState} onChange={(e) => set("paymentState", e.target.value)} className={inputBase} />
                  )}
                </label>
              </div>
            </div>
          ) : null}
        </Card>

        {/* 3. Contact & email */}
        <Card title="Contact & email settings" subtitle="Primary contact and how outbound email is sent.">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className={labelBase}>Primary contact name</span>
              <input value={org.contactName} onChange={(e) => set("contactName", e.target.value)} className={inputBase} />
            </label>
            <label>
              <span className={labelBase}>Primary contact email</span>
              <input type="email" value={org.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} className={inputBase} />
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Login email (cannot change here): {loginEmail}</p>

          <div className="mt-6 grid gap-4 rounded-xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Sender</p>
              <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{routingEmail || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Emails are sent through</p>
              <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">{systemSenderEmail}</p>
            </div>
          </div>

          {showPublicEmailBanner ? (
            <div className="mt-4 flex gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-100">
              <span className="text-lg" aria-hidden>
                ℹ️
              </span>
              <p>
                Your primary contact email uses a public provider. Outbound mail is sent via the system address{" "}
                <span className="font-mono text-xs">({systemSenderEmail})</span> to reduce spam-folder issues. Recipients will still
                see your organization name and reply-to where supported.
              </p>
            </div>
          ) : null}

          <div className="mt-6 border-t border-slate-100 pt-6 dark:border-slate-800">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                checked={org.smtpEnabled}
                onChange={(e) => set("smtpEnabled", e.target.checked)}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-600"
              />
              Configure custom SMTP (advanced)
            </label>
            {org.smtpEnabled ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className={labelBase}>SMTP host</span>
                  <input value={org.smtpHost} onChange={(e) => set("smtpHost", e.target.value)} className={inputBase} placeholder="smtp.example.com" />
                </label>
                <label>
                  <span className={labelBase}>SMTP port</span>
                  <input
                    type="number"
                    value={org.smtpPort ?? ""}
                    onChange={(e) => set("smtpPort", e.target.value ? parseInt(e.target.value, 10) : null)}
                    className={inputBase}
                    placeholder="587"
                  />
                </label>
                <p className="sm:col-span-2 text-xs text-slate-500 dark:text-slate-400">
                  Credentials and TLS options are not stored in this build — only host/port flags for future wiring.
                </p>
              </div>
            ) : null}
          </div>
        </Card>

        {/* 4 + 5 combined Regional + Language */}
        <Card title="Regional & language settings" subtitle="Books basis, calendar, and copy language.">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Regional</h3>
              <label id="settings-currency">
                <span className={labelBase}>
                  <span className={req}>*</span> Base currency
                  <Tooltip text="Reporting and default transaction currency." />
                </span>
                <CurrencySelect
                  id="settings-currency-select"
                  required
                  value={org.currency}
                  onChange={(code) => set("currency", code)}
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  <Link href="/settings/currencies" className="font-medium text-teal-700 hover:underline dark:text-teal-400">
                    Manage currencies
                  </Link>
                  {" — "}
                  Changing base may affect reports; you will be warned when switching in the currencies screen.
                </p>
              </label>
              <label>
                <span className={labelBase}>Fiscal year</span>
                <select
                  value={String(org.financialYearStartMonth)}
                  onChange={(e) => set("financialYearStartMonth", parseInt(e.target.value, 10))}
                  className={inputBase}
                >
                  {FISCAL_START_MONTHS.map((f) => (
                    <option key={f.month} value={f.month}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset>
                <legend className={`${labelBase} mb-2`}>Report basis</legend>
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="reportBasis"
                      checked={org.reportBasis === "ACCRUAL"}
                      onChange={() => set("reportBasis", "ACCRUAL")}
                      className="mt-1 text-teal-600 focus:ring-teal-600"
                    />
                    <span>
                      <span className="font-medium text-slate-900 dark:text-white">Accrual</span>
                      <span className="block text-slate-500 dark:text-slate-400">Tax and revenue follow invoice dates.</span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="reportBasis"
                      checked={org.reportBasis === "CASH"}
                      onChange={() => set("reportBasis", "CASH")}
                      className="mt-1 text-teal-600 focus:ring-teal-600"
                    />
                    <span>
                      <span className="font-medium text-slate-900 dark:text-white">Cash</span>
                      <span className="block text-slate-500 dark:text-slate-400">Recognize on payment receipt.</span>
                    </span>
                  </label>
                </div>
              </fieldset>
              <label>
                <span className={labelBase}>Time zone</span>
                <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select value={org.timezone} onChange={(e) => set("timezone", e.target.value)} className={`${inputBase} sm:flex-1`}>
                    {TIMEZONES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                    {TIMEZONES.every((t) => t.value !== org.timezone) ? (
                      <option value={org.timezone}>{org.timezone}</option>
                    ) : null}
                  </select>
                  <button
                    type="button"
                    onClick={applyDetectedTimezone}
                    className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Use this device
                  </button>
                </div>
              </label>
              <label>
                <span className={labelBase}>Date format</span>
                <select value={org.dateFormat} onChange={(e) => set("dateFormat", e.target.value)} className={inputBase}>
                  {DATE_FORMATS.map((df) => (
                    <option key={df} value={df}>
                      {df}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Language</h3>
              <label>
                <span className={labelBase}>
                  Organization language
                  <Tooltip text="Default language for generated PDFs and labels." />
                </span>
                <select
                  value={org.organizationLanguage}
                  onChange={(e) => set("organizationLanguage", e.target.value)}
                  className={inputBase}
                >
                  {UI_LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className={labelBase}>
                  Communication languages
                  <Tooltip text="Comma-separated locale codes for customer communications." />
                </span>
                <input
                  value={org.communicationLanguages}
                  onChange={(e) => set("communicationLanguages", e.target.value)}
                  className={inputBase}
                  placeholder="en, hi"
                />
              </label>
            </div>
          </div>
        </Card>

        {/* 6 Preferences */}
        <Card title="Preferences" subtitle="Light workspace options.">
          <label className="inline-flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
            <input
              type="checkbox"
              checked={org.prefWeekStartsMonday}
              onChange={(e) => set("prefWeekStartsMonday", e.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-600"
            />
            Week starts on Monday in calendars
          </label>
        </Card>

        {/* 7 Company ID */}
        <Card title="Company identification" subtitle="Tax identifiers used on Indian filings.">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className={labelBase}>Company ID</span>
              <input
                value={org.companyIdentifier}
                onChange={(e) => set("companyIdentifier", e.target.value)}
                className={inputBase}
                placeholder="Internal or registrar ID"
              />
            </label>
            <label>
              <span className={labelBase}>GSTIN</span>
              <input
                value={org.gstin}
                onChange={(e) => {
                  set("gstin", e.target.value.toUpperCase());
                  setGstHint(null);
                }}
                onBlur={() => {
                  const g = normalizeGstin(org.gstin);
                  if (g && !isValidGstin(g)) setGstHint("15-character GSTIN expected for India.");
                  else setGstHint(null);
                }}
                maxLength={15}
                className={inputBase}
                placeholder="22AAAAA0000A1Z5"
              />
              {gstHint ? <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{gstHint}</p> : null}
            </label>
            <label className="sm:col-span-2">
              <span className={labelBase}>
                PAN <span className="font-normal text-slate-500">(recommended)</span>
              </span>
              <input
                value={org.pan}
                onChange={(e) => set("pan", e.target.value.toUpperCase())}
                maxLength={10}
                className={inputBase}
                placeholder="AAAAA9999A"
              />
            </label>
          </div>
        </Card>

        {/* Account security */}
        <Card id="settings-user-account" title="Account security" subtitle="Update the signed-in user password.">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className={labelBase}>Current password</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputBase}
                autoComplete="current-password"
              />
            </label>
            <label className="sm:col-span-2">
              <span className={labelBase}>New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputBase}
                autoComplete="new-password"
              />
            </label>
          </div>
        </Card>
      </form>

      <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-end gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 lg:left-56">
        <button
          type="submit"
          form={formId}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-teal-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Save changes
        </button>
      </div>
    </div>
  );
}

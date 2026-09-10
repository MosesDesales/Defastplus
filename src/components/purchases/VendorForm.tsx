"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CurrencySelect } from "@/components/settings/CurrencySelect";
import { parseResponseJson } from "@/lib/parse-response-json";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-teal-600/20 transition focus:border-teal-600 focus:ring-4 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

const selectClass = `${inputClass} appearance-none bg-[length:1rem] bg-[right_0.6rem_center] bg-no-repeat pr-9`;

const SELECT_ARROW_STYLE = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
} as const;

type TabId = "details" | "address" | "other" | "contacts" | "bank" | "custom" | "tags" | "remarks";

const TABS: { id: TabId; label: string }[] = [
  { id: "details", label: "Vendor details" },
  { id: "address", label: "Address" },
  { id: "other", label: "Other details" },
  { id: "contacts", label: "Contact persons" },
  { id: "bank", label: "Bank details" },
  { id: "custom", label: "Custom fields" },
  { id: "tags", label: "Reporting tags" },
  { id: "remarks", label: "Remarks" },
];

const PHONE_CODES = ["+91", "+1", "+44", "+61", "+971"];

const SALUTATIONS = ["", "Mr.", "Mrs.", "Ms.", "Dr.", "M/s"];

const PAYMENT_TERMS: { value: "DUE_ON_RECEIPT" | "NET_15" | "NET_30" | "NET_45" | "NET_60"; label: string }[] = [
  { value: "DUE_ON_RECEIPT", label: "Due on Receipt" },
  { value: "NET_15", label: "Net 15" },
  { value: "NET_30", label: "Net 30" },
  { value: "NET_45", label: "Net 45" },
  { value: "NET_60", label: "Net 60" },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
];

function InfoTip({ title }: { title: string }) {
  return (
    <span
      className="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold leading-none text-slate-500 dark:border-slate-600 dark:text-slate-400"
      title={title}
    >
      i
    </span>
  );
}

function FormRow({
  label,
  required,
  tip,
  children,
}: Readonly<{
  label: string;
  required?: boolean;
  tip?: string;
  children: React.ReactNode;
}>) {
  return (
    <div className="grid gap-2 border-b border-slate-100 py-4 last:border-b-0 dark:border-slate-800 sm:grid-cols-[minmax(140px,220px)_1fr] sm:items-start sm:gap-6">
      <div className="flex justify-start gap-2 pt-2 sm:justify-end">
        <span
          className={`text-right text-sm ${required ? "font-medium text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-300"}`}
        >
          {label}
          {required ? (
            <span className="text-red-600 dark:text-red-400" aria-hidden>
              {" "}
              *
            </span>
          ) : null}
        </span>
        {tip ? <InfoTip title={tip} /> : <span className="inline-block w-4 shrink-0 sm:w-4" aria-hidden />}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function formatVendorSaveError(j: { error?: string; issues?: unknown }): string {
  const base = j.error ?? "Could not save.";
  const issues = j.issues as { fieldErrors?: Record<string, string[]>; formErrors?: string[] } | undefined;
  if (!issues) return base;
  const fe = issues.fieldErrors ?? {};
  const parts = Object.entries(fe).flatMap(([k, msgs]) => (msgs ?? []).map((m) => `${k}: ${m}`));
  const formErrs = issues.formErrors?.length ? issues.formErrors.join("; ") : "";
  const extra = [formErrs, ...parts].filter(Boolean).join("\n");
  return extra ? `${base}\n${extra}` : base;
}

type AccountRow = { id: string; code: string; name: string; type: string; isActive: boolean };

export function VendorForm({
  vendorId,
  existingDisplayNames = [],
}: Readonly<{ vendorId?: string; existingDisplayNames?: string[] }>) {
  const router = useRouter();
  const editMode = Boolean(vendorId);
  const gstRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<TabId>("details");
  const [loadingVendor, setLoadingVendor] = useState(editMode);
  const [loadingSave, setLoadingSave] = useState(false);
  const [gstHint, setGstHint] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);

  const [salutation, setSalutation] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [gstin, setGstin] = useState("");
  const [email, setEmail] = useState("");
  const [workPhoneCountryCode, setWorkPhoneCountryCode] = useState("+91");
  const [workPhone, setWorkPhone] = useState("");
  const [mobileCountryCode, setMobileCountryCode] = useState("+91");
  const [mobile, setMobile] = useState("");
  const [vendorLanguage, setVendorLanguage] = useState("en");

  const [billingAttention, setBillingAttention] = useState("");
  const [billingStreet, setBillingStreet] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [billingState, setBillingState] = useState("");
  const [billingZip, setBillingZip] = useState("");
  const [billingCountry, setBillingCountry] = useState("IN");

  const [pan, setPan] = useState("");
  const [msmeRegistered, setMsmeRegistered] = useState(false);
  const [currency, setCurrency] = useState("INR");
  const [accountsPayableAccountId, setAccountsPayableAccountId] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [paymentTerms, setPaymentTerms] = useState<
    "DUE_ON_RECEIPT" | "NET_15" | "NET_30" | "NET_45" | "NET_60"
  >("DUE_ON_RECEIPT");
  const [tdsAccountId, setTdsAccountId] = useState("");
  const [portalEnabled, setPortalEnabled] = useState(false);
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);

  const datalistId = useMemo(() => "vendor-display-names", []);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/accounting/accounts", { cache: "no-store" });
      const data = await parseResponseJson<{ accounts?: AccountRow[] }>(res, {});
      setAccounts((data.accounts ?? []).filter((a) => a.isActive));
    })();
  }, []);

  useEffect(() => {
    if (!vendorId) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/purchases/vendors/${vendorId}`, { cache: "no-store" });
      const data = await parseResponseJson<{ vendor?: Record<string, unknown> }>(res, {});
      const v = data.vendor;
      if (!cancelled && v) {
        setSalutation(String(v.salutation ?? ""));
        setFirstName(String(v.firstName ?? ""));
        setLastName(String(v.lastName ?? ""));
        setCompanyName(String(v.companyName ?? ""));
        setDisplayName(String(v.displayName ?? ""));
        setGstin(String(v.gstin ?? ""));
        setEmail(String(v.email ?? ""));
        setWorkPhoneCountryCode(String(v.workPhoneCountryCode ?? "+91"));
        setWorkPhone(String(v.workPhone ?? ""));
        setMobileCountryCode(String(v.mobileCountryCode ?? "+91"));
        setMobile(String(v.mobile ?? ""));
        setVendorLanguage(String(v.vendorLanguage ?? "en"));
        setBillingAttention(String(v.billingAttention ?? ""));
        setBillingStreet(String(v.billingStreet ?? ""));
        setBillingCity(String(v.billingCity ?? ""));
        setBillingState(String(v.billingState ?? ""));
        setBillingZip(String(v.billingZip ?? ""));
        setBillingCountry(String(v.billingCountry ?? "IN"));
        setPan(String(v.pan ?? ""));
        setMsmeRegistered(Boolean(v.msmeRegistered ?? false));
        setCurrency(String(v.currency ?? "INR"));
        setAccountsPayableAccountId(String(v.accountsPayableAccountId ?? ""));
        setOpeningBalance(String(v.openingBalance ?? "0"));
        const pt = v.paymentTerms as string | undefined;
        if (pt && ["DUE_ON_RECEIPT", "NET_15", "NET_30", "NET_45", "NET_60"].includes(pt)) {
          setPaymentTerms(pt as "DUE_ON_RECEIPT" | "NET_15" | "NET_30" | "NET_45" | "NET_60");
        }
        setTdsAccountId(String(v.tdsAccountId ?? ""));
        setPortalEnabled(Boolean(v.portalEnabled ?? false));
        setNotes(String(v.notes ?? ""));
        setIsActive(Boolean(v.isActive ?? true));
      }
      if (!cancelled) setLoadingVendor(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  const apOptions = useMemo(
    () => accounts.filter((a) => a.type === "LIABILITY"),
    [accounts],
  );
  const tdsOptions = useMemo(
    () => accounts.filter((a) => a.type === "LIABILITY" || a.type === "EXPENSE"),
    [accounts],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const obRaw = openingBalance.trim() === "" ? 0 : Number.parseFloat(openingBalance);
    if (Number.isNaN(obRaw) || !Number.isFinite(obRaw)) {
      alert("Opening balance must be a valid number.");
      setTab("other");
      return;
    }

    setLoadingSave(true);
    try {
      const body = {
        displayName: displayName.trim(),
        companyName: companyName.trim() || null,
        salutation: salutation || null,
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
        email: email.trim() || null,
        workPhoneCountryCode,
        workPhone: workPhone.trim() || null,
        mobileCountryCode,
        mobile: mobile.trim() || null,
        vendorLanguage,
        gstin: gstin.trim() || null,
        billingAttention: billingAttention.trim() || null,
        billingStreet: billingStreet.trim() || null,
        billingCity: billingCity.trim() || null,
        billingState: billingState.trim() || null,
        billingZip: billingZip.trim() || null,
        billingCountry: billingCountry.trim() || "IN",
        pan: pan.trim() || null,
        msmeRegistered,
        currency,
        accountsPayableAccountId: accountsPayableAccountId.trim() || null,
        openingBalance: obRaw,
        paymentTerms,
        tdsAccountId: tdsAccountId.trim() || null,
        portalEnabled,
        notes: notes.trim() || null,
        isActive,
      };

      const res = await fetch(editMode ? `/api/purchases/vendors/${vendorId}` : "/api/purchases/vendors", {
        method: editMode ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "same-origin",
      });
      const j = await parseResponseJson<{ error?: string; issues?: unknown }>(res, {});
      if (!res.ok) {
        alert(formatVendorSaveError(j));
        return;
      }
      router.push("/dashboard/purchases/vendors");
      router.refresh();
    } finally {
      setLoadingSave(false);
    }
  }

  if (loadingVendor) {
    return <p className="px-4 py-8 text-slate-500">Loading…</p>;
  }

  return (
    <form onSubmit={submit} className="mt-6">
      <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
        <div className="flex flex-wrap items-start gap-2">
          <span className="mt-0.5 text-sky-700 dark:text-sky-300" aria-hidden>
            ◆
          </span>
          <div className="min-w-0 flex-1">
            <p>
              Prefill Vendor details from the GST portal using the Vendor&apos;s GSTIN.{" "}
              <button
                type="button"
                className="font-semibold text-sky-800 underline underline-offset-2 hover:text-sky-900 dark:text-sky-200"
                onClick={() => {
                  setGstHint("GST portal prefill is not connected yet. Enter GSTIN below when available.");
                  gstRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
              >
                Prefill &gt;
              </button>
            </p>
            {gstHint ? <p className="mt-2 text-xs text-sky-800/90 dark:text-sky-200/90">{gstHint}</p> : null}
          </div>
        </div>
      </div>

      <div ref={gstRef} className="mt-6 flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "border-teal-600 text-teal-800 dark:border-teal-400 dark:text-teal-200"
                : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-2 rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-6">
        {tab === "details" ? (
          <div className="py-2">
            <FormRow label="Primary contact">
              <div className="grid gap-3 sm:grid-cols-3">
                <select
                  value={salutation}
                  onChange={(e) => setSalutation(e.target.value)}
                  className={selectClass}
                  style={SELECT_ARROW_STYLE}
                >
                  {SALUTATIONS.map((s) => (
                    <option key={s || "none"} value={s}>
                      {s || "Salutation"}
                    </option>
                  ))}
                </select>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className={inputClass}
                  autoComplete="given-name"
                />
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className={inputClass}
                  autoComplete="family-name"
                />
              </div>
            </FormRow>

            <FormRow label="Company name">
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Registered business name"
                className={inputClass}
              />
            </FormRow>

            <FormRow label="Display name" required tip="Shown on bills and vendor lists.">
              <>
                <datalist id={datalistId}>
                  {existingDisplayNames.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
                <input
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Select or type to add"
                  list={datalistId}
                  className={inputClass}
                />
              </>
            </FormRow>

            <FormRow label="GSTIN" tip="Used for GST portal prefill when integrated.">
              <input
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="15-character GSTIN"
                maxLength={20}
                className={inputClass}
              />
            </FormRow>

            <FormRow label="Email address">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden>
                  ✉
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  autoComplete="email"
                  className={`${inputClass} pl-10`}
                />
              </div>
            </FormRow>

            <FormRow label="Phone">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">Work phone</p>
                  <div className="flex gap-2">
                    <select
                      value={workPhoneCountryCode}
                      onChange={(e) => setWorkPhoneCountryCode(e.target.value)}
                      className={`${selectClass} w-[5.5rem] shrink-0`}
                      style={SELECT_ARROW_STYLE}
                    >
                      {PHONE_CODES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <input
                      value={workPhone}
                      onChange={(e) => setWorkPhone(e.target.value)}
                      placeholder="Work phone"
                      inputMode="tel"
                      className={`${inputClass} min-w-0 flex-1`}
                    />
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">Mobile</p>
                  <div className="flex gap-2">
                    <select
                      value={mobileCountryCode}
                      onChange={(e) => setMobileCountryCode(e.target.value)}
                      className={`${selectClass} w-[5.5rem] shrink-0`}
                      style={SELECT_ARROW_STYLE}
                    >
                      {PHONE_CODES.map((c) => (
                        <option key={`m-${c}`} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <input
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="Mobile"
                      inputMode="tel"
                      className={`${inputClass} min-w-0 flex-1`}
                    />
                  </div>
                </div>
              </div>
            </FormRow>

            <FormRow label="Vendor language">
              <select
                value={vendorLanguage}
                onChange={(e) => setVendorLanguage(e.target.value)}
                className={selectClass}
                style={SELECT_ARROW_STYLE}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </FormRow>

            <FormRow label="Active">
              <label className="flex cursor-pointer items-start gap-3 pt-2 text-sm text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-600"
                />
                <span>Vendor is active</span>
              </label>
            </FormRow>
          </div>
        ) : null}

        {tab === "address" ? (
          <div className="py-2">
            <FormRow label="Attention">
              <input
                value={billingAttention}
                onChange={(e) => setBillingAttention(e.target.value)}
                placeholder="Billing address — attention"
                className={inputClass}
              />
            </FormRow>
            <FormRow label="Street">
              <textarea
                value={billingStreet}
                onChange={(e) => setBillingStreet(e.target.value)}
                placeholder="Street address"
                rows={3}
                className={`${inputClass} resize-y min-h-[5rem]`}
              />
            </FormRow>
            <FormRow label="City">
              <input value={billingCity} onChange={(e) => setBillingCity(e.target.value)} className={inputClass} />
            </FormRow>
            <FormRow label="State">
              <input value={billingState} onChange={(e) => setBillingState(e.target.value)} className={inputClass} />
            </FormRow>
            <FormRow label="ZIP / Postal code">
              <input value={billingZip} onChange={(e) => setBillingZip(e.target.value)} className={inputClass} />
            </FormRow>
            <FormRow label="Country">
              <input
                value={billingCountry}
                onChange={(e) => setBillingCountry(e.target.value)}
                placeholder="IN"
                className={inputClass}
              />
            </FormRow>
          </div>
        ) : null}

        {tab === "other" ? (
          <div className="py-2">
            <FormRow label="PAN" tip="Permanent Account Number for India tax records.">
              <input value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} maxLength={20} className={inputClass} />
            </FormRow>

            <FormRow label="MSME registered?" tip="Track Micro, Small & Medium Enterprise vendors.">
              <label className="flex cursor-pointer items-start gap-3 pt-2 text-sm text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={msmeRegistered}
                  onChange={(e) => setMsmeRegistered(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-600"
                />
                <span>This vendor is MSME registered</span>
              </label>
            </FormRow>

            <FormRow label="Currency">
              <CurrencySelect
                value={currency}
                onChange={setCurrency}
                selectClassName={selectClass}
                selectStyle={SELECT_ARROW_STYLE}
              />
            </FormRow>

            <FormRow label="Accounts payable" tip="Default liability account for amounts owed to this vendor.">
              <select
                value={accountsPayableAccountId}
                onChange={(e) => setAccountsPayableAccountId(e.target.value)}
                className={selectClass}
                style={SELECT_ARROW_STYLE}
              >
                <option value="">Select an account</option>
                {apOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </FormRow>

            <FormRow label="Opening balance">
              <div className="relative max-w-xs">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  {currency}
                </span>
                <input
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className={`${inputClass} pl-14 tabular-nums`}
                />
              </div>
            </FormRow>

            <FormRow label="Payment terms">
              <select
                value={paymentTerms}
                onChange={(e) =>
                  setPaymentTerms(e.target.value as "DUE_ON_RECEIPT" | "NET_15" | "NET_30" | "NET_45" | "NET_60")
                }
                className={selectClass}
                style={SELECT_ARROW_STYLE}
              >
                {PAYMENT_TERMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </FormRow>

            <FormRow label="TDS" tip="Withholding tax account or rate mapping (optional).">
              <select
                value={tdsAccountId}
                onChange={(e) => setTdsAccountId(e.target.value)}
                className={selectClass}
                style={SELECT_ARROW_STYLE}
              >
                <option value="">Select a tax</option>
                {tdsOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </FormRow>

            <FormRow label="Enable portal?" tip="Allows this vendor to sign in to a portal for bills and statements.">
              <label className="flex cursor-pointer items-start gap-3 pt-2 text-sm text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={portalEnabled}
                  onChange={(e) => setPortalEnabled(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-600"
                />
                <span>Allow portal access for this vendor</span>
              </label>
            </FormRow>

            <FormRow label="Documents">
              <div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                  <span aria-hidden>⬆</span>
                  Upload file
                  <input type="file" multiple className="hidden" disabled />
                </label>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  You can upload a maximum of 10 files, 10MB each. Storage integration is coming soon — selections are not
                  saved yet.
                </p>
              </div>
            </FormRow>

            <div className="py-4">
              <button
                type="button"
                className="text-sm font-medium text-teal-600 underline-offset-2 hover:underline dark:text-teal-400"
                onClick={() => setTab("details")}
              >
                Add more details
              </button>
            </div>
          </div>
        ) : null}

        {tab === "contacts" ? (
          <p className="py-10 text-center text-sm text-slate-600 dark:text-slate-400">
            Additional contact persons will be manageable here in a future update.
          </p>
        ) : null}

        {tab === "bank" ? (
          <p className="py-10 text-center text-sm text-slate-600 dark:text-slate-400">
            Bank account details for vendor payments will be stored here in a future update.
          </p>
        ) : null}

        {tab === "custom" ? (
          <p className="py-10 text-center text-sm text-slate-600 dark:text-slate-400">
            Custom fields will be configurable here once your organisation defines field definitions.
          </p>
        ) : null}

        {tab === "tags" ? (
          <p className="py-10 text-center text-sm text-slate-600 dark:text-slate-400">
            Reporting tags can be attached here for analytics and filters.
          </p>
        ) : null}

        {tab === "remarks" ? (
          <div className="py-4">
            <label htmlFor="vendor-notes" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Remarks
            </label>
            <textarea
              id="vendor-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              placeholder="Internal notes about this vendor"
              className={`${inputClass} resize-y min-h-[8rem]`}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={loadingSave}
          className="rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60 dark:bg-teal-500"
        >
          {loadingSave ? "Saving…" : "Save"}
        </button>
        <Link
          href="/dashboard/purchases/vendors"
          className="rounded-lg border border-slate-200 bg-white px-6 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

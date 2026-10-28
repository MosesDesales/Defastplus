"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Lock } from "lucide-react";
import { formatInr } from "@/lib/superadmin/entitlements";
import type { AdminUserDTO, ModuleCatalog, PlanDTO, UserDetailResponse } from "@/components/superadmin/types";
import {
  apiJson,
  btnDanger,
  btnPrimary,
  btnSecondary,
  cx,
  formatDate,
  inputClass,
  labelClass,
  Modal,
  SubscriptionBadge,
} from "@/components/superadmin/ui";

type DialogProps = {
  user: AdminUserDTO;
  onClose: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
};

// ── Activate / deactivate ────────────────────────────────────────────────────

export function StatusDialog({ user, onClose, onDone, onError }: DialogProps) {
  const activating = !user.isActive;
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await apiJson(`/api/superadmin/users/${user.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ active: activating, reason: reason.trim() || undefined }),
      });
      onDone(activating ? `${user.email} has been activated.` : `${user.email} has been deactivated and signed out.`);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={activating ? "Activate account?" : "Deactivate account?"}
      subtitle={user.email}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={activating ? btnPrimary : btnDanger} onClick={submit} disabled={busy}>
            {busy ? "Saving…" : activating ? "Activate" : "Deactivate"}
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
        {activating ? (
          <p>The user will be able to sign in again with their existing password. Their data is unchanged.</p>
        ) : (
          <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              The user is signed out of every device and can no longer sign in. Invoices, ledgers, GST data and all
              transaction history are kept and become available again if the account is reactivated.
            </p>
          </div>
        )}
        <div>
          <label htmlFor="status-reason" className={labelClass}>
            Reason (recorded in the audit log, optional)
          </label>
          <input id="status-reason" className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </div>
      </div>
    </Modal>
  );
}

// ── Change subscription plan ─────────────────────────────────────────────────

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

function addInterval(start: string, interval: "MONTHLY" | "ANNUAL"): string {
  const d = new Date(`${start}T00:00:00`);
  if (interval === "ANNUAL") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export function PlanDialog({ user, plans, onClose, onDone, onError }: DialogProps & { plans: PlanDTO[] }) {
  const [detail, setDetail] = useState<UserDetailResponse | null>(null);
  const [planId, setPlanId] = useState(user.plan?.id ?? "");
  const [interval, setBillingInterval] = useState<"MONTHLY" | "ANNUAL">(
    (user.subscription?.billingInterval as "MONTHLY" | "ANNUAL" | undefined) ?? "MONTHLY",
  );
  const [statusChoice, setStatus] = useState<"ACTIVE" | "TRIAL">(user.subscription?.storedStatus === "TRIAL" ? "TRIAL" : "ACTIVE");
  const [startsAt, setStartsAt] = useState(new Date().toISOString().slice(0, 10));
  const [expiresAt, setExpiresAt] = useState(toDateInput(user.subscription?.expiresAt));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiJson<UserDetailResponse>(`/api/superadmin/users/${user.id}`).then(setDetail).catch(() => setDetail(null));
  }, [user.id]);

  const plan = plans.find((p) => p.id === planId) ?? null;
  const price = plan ? (interval === "ANNUAL" ? plan.annualPrice : plan.monthlyPrice) : 0;
  const seats = detail?.usage.users ?? null;
  const overSeats = plan?.maxUsers != null && seats != null && seats > plan.maxUsers;
  const trialAllowed = Boolean(plan && plan.trialDays > 0);
  const status = trialAllowed ? statusChoice : "ACTIVE";


  async function submit() {
    if (!plan) return;
    setBusy(true);
    try {
      await apiJson(`/api/superadmin/users/${user.id}/subscription`, {
        method: "PUT",
        body: JSON.stringify({
          planId: plan.id,
          billingInterval: interval,
          status,
          startsAt: new Date(`${startsAt}T00:00:00`).toISOString(),
          expiresAt: status === "TRIAL" || !expiresAt ? (status === "TRIAL" ? undefined : null) : new Date(`${expiresAt}T23:59:59`).toISOString(),
          note: note.trim() || undefined,
        }),
      });
      onDone(`${user.email} is now on the ${plan.name} plan.`);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      wide
      title="Change subscription plan"
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          {user.email} · Current: <strong className="font-medium text-slate-700 dark:text-slate-200">{user.plan?.name ?? "No plan (full access)"}</strong>
          {user.subscription ? <SubscriptionBadge status={user.subscription.status} /> : null}
        </span>
      }
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={btnPrimary} onClick={submit} disabled={busy || !plan || overSeats}>
            {busy ? "Saving…" : "Apply plan"}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700" role="radiogroup" aria-label="Billing interval">
          {(["MONTHLY", "ANNUAL"] as const).map((iv) => (
            <button
              key={iv}
              type="button"
              role="radio"
              aria-checked={interval === iv}
              onClick={() => {
                setBillingInterval(iv);
                if (expiresAt) setExpiresAt(addInterval(startsAt, iv));
              }}
              className={cx(
                "rounded-md px-3 py-1.5 text-sm font-medium transition",
                interval === iv ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
              )}
            >
              {iv === "MONTHLY" ? "Monthly" : "Annual"}
            </button>
          ))}
        </div>

        {plans.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No subscription plans are configured. Run <code>npm run seed:plans</code> to create the default catalogue.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Plan">
            {plans.map((p) => {
              const selected = p.id === planId;
              const pPrice = interval === "ANNUAL" ? p.annualPrice : p.monthlyPrice;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setPlanId(p.id)}
                  className={cx(
                    "relative rounded-xl border p-4 text-left transition",
                    selected
                      ? "border-teal-500 bg-teal-50/60 ring-2 ring-teal-500/30 dark:bg-teal-950/30"
                      : "border-slate-200 hover:border-teal-300 dark:border-slate-700 dark:hover:border-teal-700",
                  )}
                >
                  {selected ? <Check className="absolute right-3 top-3 h-4 w-4 text-teal-600" aria-hidden /> : null}
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white">{p.name}</span>
                    {user.plan?.id === p.id ? <span className="text-[11px] font-medium text-teal-700 dark:text-teal-300">Current</span> : null}
                  </div>
                  <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                    {p.isFree ? formatInr(0, 0) : formatInr(pPrice, 0)}
                    {!p.isFree ? (
                      <span className="text-xs font-normal text-slate-500"> / {interval === "ANNUAL" ? "year" : "month"} + GST</span>
                    ) : null}
                  </p>
                  <ul className="mt-2 space-y-0.5 text-xs text-slate-600 dark:text-slate-400">
                    <li>{p.maxUsers == null ? "Unlimited users" : `Up to ${p.maxUsers} user${p.maxUsers === 1 ? "" : "s"}`}</li>
                    <li>{p.maxCompanies == null ? "Unlimited companies" : `${p.maxCompanies} compan${p.maxCompanies === 1 ? "y" : "ies"}`}</li>
                    <li>{p.allModules ? "All modules" : `${p.modules.length} modules`}</li>
                    {p.trialDays > 0 ? <li>{p.trialDays}-day trial</li> : null}
                    {p.features.slice(0, 3).map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>
        )}

        {plan ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="plan-status" className={labelClass}>
                Subscription type
              </label>
              <select id="plan-status" className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as "ACTIVE" | "TRIAL")}>
                <option value="ACTIVE">Active</option>
                <option value="TRIAL" disabled={!trialAllowed}>
                  Trial{trialAllowed ? ` (${plan.trialDays} days)` : " (not offered)"}
                </option>
              </select>
            </div>
            <div>
              <label htmlFor="plan-start" className={labelClass}>
                Activation date
              </label>
              <input id="plan-start" type="date" className={inputClass} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div>
              <label htmlFor="plan-expiry" className={labelClass}>
                Expiry date {status === "TRIAL" ? "(trial end)" : "(blank = no expiry)"}
              </label>
              <input
                id="plan-expiry"
                type="date"
                className={inputClass}
                value={status === "TRIAL" ? addDays(startsAt, plan.trialDays) : expiresAt}
                min={startsAt}
                disabled={status === "TRIAL"}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>
        ) : null}

        {plan ? (
          <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
            <p>
              Amount recorded:{" "}
              <strong>{status === "TRIAL" || plan.isFree ? formatInr(0) : formatInr(price)}</strong>
              {status === "TRIAL" || plan.isFree ? "" : ` per ${interval === "ANNUAL" ? "year" : "month"}, excl. GST`}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              No payment is collected. This application has no payment gateway; the change only updates entitlements and
              revenue reporting.
            </p>
            {seats != null ? (
              <p className={cx("mt-2 text-xs", overSeats ? "font-medium text-red-600 dark:text-red-400" : "text-slate-500")}>
                Users on this account: {seats}
                {plan.maxUsers != null ? ` / ${plan.maxUsers} allowed` : ""}
                {overSeats ? " — deactivate team members before moving to this plan." : ""}
              </p>
            ) : null}
            {user.moduleAccessRestricted && !plan.allModules ? (
              <p className="mt-1 text-xs text-slate-500">
                Custom module assignments outside this plan will be removed.
              </p>
            ) : null}
          </div>
        ) : null}

        <div>
          <label htmlFor="plan-note" className={labelClass}>
            Internal note (audit log, optional)
          </label>
          <input id="plan-note" className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </div>
      </div>
    </Modal>
  );
}

function addDays(start: string, days: number): string {
  const d = new Date(`${start}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── Assign / remove modules ──────────────────────────────────────────────────

const CATEGORY_LABEL: Record<string, string> = {
  core: "Core Accounting",
  gst: "Indian GST and Taxation",
  business: "Other Business Modules",
};

export function ModulesDialog({
  user,
  plans,
  catalog,
  onClose,
  onDone,
  onError,
}: DialogProps & { plans: PlanDTO[]; catalog: ModuleCatalog }) {
  const plan = plans.find((p) => p.id === user.plan?.id) ?? null;
  const inPlan = useMemo(
    () => new Set(plan ? plan.modules : catalog.modules.map((m) => m.key)),
    [plan, catalog.modules],
  );
  const [restricted, setRestricted] = useState(user.moduleAccessRestricted);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(user.moduleAccessRestricted ? user.assignedModules : user.effectiveModules),
  );
  const [busy, setBusy] = useState(false);

  const assignable = (key: string) => inPlan.has(key) && !catalog.modules.find((m) => m.key === key)?.required;

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function setMany(keys: string[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        if (!assignable(k)) continue;
        if (on) next.add(k);
        else next.delete(k);
      }
      return next;
    });
  }

  async function submit() {
    setBusy(true);
    try {
      await apiJson(`/api/superadmin/users/${user.id}/modules`, {
        method: "PUT",
        body: JSON.stringify({ restricted, modules: restricted ? [...selected].filter((k) => inPlan.has(k)) : [] }),
      });
      onDone(`Module access updated for ${user.email}.`);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const groups = (["core", "gst", "business"] as const).map((cat) => ({
    cat,
    modules: catalog.modules.filter((m) => m.category === cat),
    unavailable: catalog.unavailable.filter((m) => m.category === cat),
    bundled: catalog.bundled.filter((m) => m.category === cat),
  }));
  const selectedCount = catalog.modules.filter((m) => m.required || (selected.has(m.key) && inPlan.has(m.key))).length;

  return (
    <Modal
      wide
      title="Assign modules"
      subtitle={`${user.email} · Plan: ${user.plan?.name ?? "No plan (all modules)"}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={btnPrimary} onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Save assignments"}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">Access mode</legend>
          {[
            { v: false, t: "All plan modules", d: "The user automatically receives everything their plan includes." },
            { v: true, t: "Custom selection", d: "Only the modules ticked below (always limited by the plan)." },
          ].map((o) => (
            <label
              key={String(o.v)}
              className={cx(
                "cursor-pointer rounded-xl border p-3 text-sm transition",
                restricted === o.v ? "border-teal-500 bg-teal-50/60 dark:bg-teal-950/30" : "border-slate-200 dark:border-slate-700",
              )}
            >
              <input type="radio" name="access-mode" className="sr-only" checked={restricted === o.v} onChange={() => setRestricted(o.v)} />
              <span className="font-medium text-slate-900 dark:text-white">{o.t}</span>
              <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{o.d}</span>
            </label>
          ))}
        </fieldset>

        {restricted ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-slate-600 dark:text-slate-400">{selectedCount} modules selected</span>
            <div className="flex gap-2">
              <button type="button" className={btnSecondary} onClick={() => setMany(catalog.modules.map((m) => m.key), true)}>
                Select all
              </button>
              <button type="button" className={btnSecondary} onClick={() => setMany(catalog.modules.map((m) => m.key), false)}>
                Deselect all
              </button>
            </div>
          </div>
        ) : null}

        {groups.map((g) => (
          <section key={g.cat}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400">{CATEGORY_LABEL[g.cat]}</h3>
              {restricted ? (
                <div className="flex gap-3 text-xs">
                  <button type="button" className="font-medium text-teal-700 hover:underline dark:text-teal-400" onClick={() => setMany(g.modules.map((m) => m.key), true)}>
                    Select all
                  </button>
                  <button type="button" className="font-medium text-slate-500 hover:underline" onClick={() => setMany(g.modules.map((m) => m.key), false)}>
                    Deselect all
                  </button>
                </div>
              ) : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {g.modules.map((m) => {
                const planOk = inPlan.has(m.key);
                const checked = m.required || (planOk && (restricted ? selected.has(m.key) : true));
                const disabled = !restricted || m.required || !planOk;
                return (
                  <label
                    key={m.key}
                    className={cx(
                      "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm",
                      disabled ? "border-slate-100 dark:border-slate-800" : "cursor-pointer border-slate-200 hover:border-teal-300 dark:border-slate-700",
                      !planOk && "opacity-60",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggle(m.key)}
                    />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5 font-medium text-slate-800 dark:text-slate-100">
                        {m.label}
                        {m.required ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-slate-500">
                            <Lock className="h-3 w-3" aria-hidden /> Always on
                          </span>
                        ) : null}
                        {!planOk ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                            Not in plan
                          </span>
                        ) : null}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">{m.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {g.bundled.length || g.unavailable.length ? (
              <ul className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                {g.bundled.map((b) => (
                  <li key={b.label}>
                    <span className="font-medium text-slate-600 dark:text-slate-300">{b.label}</span> — included with{" "}
                    {b.providedBy.map((k) => catalog.modules.find((m) => m.key === k)?.label ?? k).join(", ")}. {b.note}
                  </li>
                ))}
                {g.unavailable.map((u) => (
                  <li key={u.label}>
                    <span className="font-medium text-slate-600 dark:text-slate-300">{u.label}</span> — not available in this
                    build. {u.note}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Changes take effect within a few seconds: hidden from navigation, and blocked for direct URLs and API requests.
          Last signed in: {formatDate(user.lastLoginAt)}.
        </p>
      </div>
    </Modal>
  );
}

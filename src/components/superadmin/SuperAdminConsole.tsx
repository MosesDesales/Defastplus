"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BadgeIndianRupee,
  Download,
  FlaskConical,
  History,
  IdCard,
  Layers,
  LayoutGrid,
  Lock,
  Power,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TableRowActions } from "@/components/TableRowActions";
import { formatInr } from "@/lib/superadmin/entitlements";
import { ModulesDialog, PlanDialog, StatusDialog } from "@/components/superadmin/SuperAdminDialogs";
import type {
  AdminUserDTO,
  AuditLogDTO,
  ModuleCatalog,
  StatsDTO,
  UserListResponse,
} from "@/components/superadmin/types";
import {
  apiJson,
  btnSecondary,
  cx,
  formatDate,
  formatDateTime,
  inputClass,
  labelClass,
  plural,
  selectClass,
  StatusBadge,
  SubscriptionBadge,
  Toast,
  type ToastState,
} from "@/components/superadmin/ui";

type SortKey = "email" | "createdAt" | "lastLoginAt" | "plan";

type Filters = {
  q: string;
  status: string;
  plan: string;
  module: string;
  signupFrom: string;
  signupTo: string;
  lastLoginFrom: string;
  lastLoginTo: string;
  neverLoggedIn: string;
  sort: SortKey;
  dir: "asc" | "desc";
  page: number;
  pageSize: number;
};

const INITIAL_FILTERS: Filters = {
  q: "",
  status: "",
  plan: "",
  module: "",
  signupFrom: "",
  signupTo: "",
  lastLoginFrom: "",
  lastLoginTo: "",
  neverLoggedIn: "",
  sort: "createdAt",
  dir: "desc",
  page: 1,
  pageSize: 25,
};

function toQuery(f: Filters, extra?: Record<string, string>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== "" && v != null) p.set(k, String(v));
  for (const [k, v] of Object.entries(extra ?? {})) p.set(k, v);
  return p.toString();
}

type Dialog = { kind: "status" | "plan" | "modules"; user: AdminUserDTO } | null;

export function SuperAdminConsole() {
  const [stats, setStats] = useState<StatsDTO | null>(null);
  const [catalog, setCatalog] = useState<ModuleCatalog | null>(null);
  /** Last loaded page, tagged with the query it answers so loading state is derived. */
  const [listState, setListState] = useState<{ query: string; data: UserListResponse } | null>(null);
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [searchDraft, setSearchDraft] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const query = toQuery(filters);
  const list = listState?.data ?? null;
  const loading = listState?.query !== `${query}#${reloadToken}`;
  const [dialog, setDialog] = useState<Dialog>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [tab, setTab] = useState<"users" | "audit">("users");
  const [auditUser, setAuditUser] = useState<AdminUserDTO | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      setStats(await apiJson<StatsDTO>("/api/superadmin/stats"));
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  const reloadUsers = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    apiJson<StatsDTO>("/api/superadmin/stats").then(setStats).catch((e) => setLoadError((e as Error).message));
    apiJson<ModuleCatalog>("/api/superadmin/modules").then(setCatalog).catch((e) => setLoadError((e as Error).message));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tag = `${query}#${reloadToken}`;
    apiJson<UserListResponse>(`/api/superadmin/users?${query}`)
      .then((data) => {
        if (cancelled) return;
        setListState({ query: tag, data });
        setLoadError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError((e as Error).message);
        setListState((prev) => (prev ? { ...prev, query: tag } : prev));
      });
    return () => {
      cancelled = true;
    };
  }, [query, reloadToken]);

  // Debounced search box.
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.q === searchDraft.trim() ? f : { ...f, q: searchDraft.trim(), page: 1 }));
    }, 300);
    return () => clearTimeout(t);
  }, [searchDraft]);

  const setFilter = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));

  function toggleSort(key: SortKey) {
    setFilters((f) => ({
      ...f,
      sort: key,
      dir: f.sort === key ? (f.dir === "asc" ? "desc" : "asc") : key === "email" || key === "plan" ? "asc" : "desc",
      page: 1,
    }));
  }

  const plans = stats?.plans ?? [];
  const moduleLabels = useMemo(() => new Map(catalog?.modules.map((m) => [m.key, m.label]) ?? []), [catalog]);
  const activeFilterCount = ["status", "plan", "module", "signupFrom", "signupTo", "lastLoginFrom", "lastLoginTo", "neverLoggedIn"].filter(
    (k) => filters[k as keyof Filters] !== "",
  ).length;

  function afterMutation(message: string) {
    setDialog(null);
    setToast({ kind: "success", message });
    void loadStats();
    reloadUsers();
  }

  const cards: Array<{ label: string; value: string; icon: LucideIcon; tone: string; hint?: string }> = stats
    ? [
        { label: "Total registered users", value: stats.totalUsers.toLocaleString("en-IN"), icon: Users, tone: "text-slate-700 bg-slate-100 dark:bg-slate-800 dark:text-slate-200" },
        { label: "Active users", value: stats.activeUsers.toLocaleString("en-IN"), icon: UserCheck, tone: "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300" },
        { label: "Inactive users", value: stats.inactiveUsers.toLocaleString("en-IN"), icon: UserX, tone: "text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300" },
        { label: "Trial users", value: stats.trialUsers.toLocaleString("en-IN"), icon: FlaskConical, tone: "text-sky-700 bg-sky-50 dark:bg-sky-950/50 dark:text-sky-300" },
        { label: "Paid subscribers", value: stats.paidSubscribers.toLocaleString("en-IN"), icon: Wallet, tone: "text-teal-700 bg-teal-50 dark:bg-teal-950/50 dark:text-teal-300" },
        { label: "Free plan users", value: stats.freePlanUsers.toLocaleString("en-IN"), icon: IdCard, tone: "text-violet-700 bg-violet-50 dark:bg-violet-950/50 dark:text-violet-300", hint: stats.noPlanUsers ? `${stats.noPlanUsers} without a plan` : undefined },
        { label: "Monthly subscription revenue", value: formatInr(stats.monthlyRevenue), icon: BadgeIndianRupee, tone: "text-amber-700 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-300", hint: "MRR, excl. GST · annual ÷ 12" },
        { label: "Available plans", value: String(stats.plans.length), icon: Layers, tone: "text-indigo-700 bg-indigo-50 dark:bg-indigo-950/50 dark:text-indigo-300" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Administration</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Super User Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Manage registered accounts, subscriptions, and module access. Amounts in Indian Rupees (₹).
          </p>
        </div>
        <button
          type="button"
          className={btnSecondary}
          onClick={() => {
            void loadStats();
            reloadUsers();
          }}
        >
          <RefreshCw className="h-4 w-4" aria-hidden /> Refresh
        </button>
      </div>

      {loadError ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {loadError}
        </div>
      ) : null}

      {/* Stats */}
      <section aria-label="Statistics" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats
          ? cards.map((c) => (
              <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{c.label}</p>
                  <span className={cx("rounded-lg p-1.5", c.tone)}>
                    <c.icon className="h-4 w-4" aria-hidden />
                  </span>
                </div>
                <p className="mt-2 truncate text-xl font-semibold tabular-nums text-slate-900 dark:text-white sm:text-2xl">{c.value}</p>
                {c.hint ? <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{c.hint}</p> : null}
              </div>
            ))
          : Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-[104px] animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
            ))}
      </section>

      {/* Plans */}
      {stats ? (
        <section aria-label="Subscription plans">
          <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Subscription plans</h2>
          {plans.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
              No plans configured yet. Run <code>npm run seed:plans</code> to create the default catalogue.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {plans.map((p) => (
                <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900 dark:text-white">{p.name}</p>
                    <span className="text-xs text-slate-500">{plural(p.subscriberCount, "subscriber")}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                    {p.isFree ? (p.trialDays ? `Free · ${p.trialDays}-day trial` : "Free") : `${formatInr(p.monthlyPrice, 0)}/mo · ${formatInr(p.annualPrice, 0)}/yr`}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {p.maxUsers == null ? "Unlimited users" : `Up to ${plural(p.maxUsers, "user")}`} · {p.allModules ? "All modules" : `${p.modules.length} modules`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800" role="tablist">
        {[
          { id: "users" as const, label: "Users", icon: Users },
          { id: "audit" as const, label: "Audit log", icon: History },
        ].map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              if (t.id === "users") setAuditUser(null);
            }}
            className={cx(
              "-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition",
              tab === t.id
                ? "border-teal-600 text-teal-800 dark:border-teal-400 dark:text-teal-200"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200",
            )}
          >
            <t.icon className="h-4 w-4" aria-hidden /> {t.label}
          </button>
        ))}
      </div>

      {tab === "audit" ? (
        <AuditLogPanel key={auditUser?.id ?? "all"} filterUser={auditUser} onClearFilter={() => setAuditUser(null)} moduleLabels={moduleLabels} />
      ) : (
        <section aria-label="User management" className="space-y-3">
          {/* Toolbar */}
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="search"
                aria-label="Search by user ID or email"
                placeholder="Search by user ID, email, or name"
                className={cx(inputClass, "pl-9")}
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select aria-label="Account status" className={cx(selectClass, "flex-1 sm:flex-none")} value={filters.status} onChange={(e) => setFilter({ status: e.target.value })}>
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <select aria-label="Subscription plan" className={cx(selectClass, "flex-1 sm:flex-none")} value={filters.plan} onChange={(e) => setFilter({ plan: e.target.value })}>
                <option value="">All plans</option>
                <option value="none">No plan</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button type="button" className={btnSecondary} onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
                More filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
              </button>
              <a className={btnSecondary} href={`/api/superadmin/users/export?${toQuery({ ...filters, page: 1 })}`}>
                <Download className="h-4 w-4" aria-hidden /> Export CSV
              </a>
            </div>
          </div>

          {showFilters ? (
            <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className={labelClass} htmlFor="f-module">
                  Assigned module
                </label>
                <select id="f-module" className={inputClass} value={filters.module} onChange={(e) => setFilter({ module: e.target.value })}>
                  <option value="">Any module</option>
                  {catalog?.modules.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass} htmlFor="f-sf">
                    Signed up from
                  </label>
                  <input id="f-sf" type="date" className={inputClass} value={filters.signupFrom} onChange={(e) => setFilter({ signupFrom: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="f-st">
                    to
                  </label>
                  <input id="f-st" type="date" className={inputClass} value={filters.signupTo} onChange={(e) => setFilter({ signupTo: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass} htmlFor="f-lf">
                    Last login from
                  </label>
                  <input id="f-lf" type="date" className={inputClass} disabled={!!filters.neverLoggedIn} value={filters.lastLoginFrom} onChange={(e) => setFilter({ lastLoginFrom: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="f-lt">
                    to
                  </label>
                  <input id="f-lt" type="date" className={inputClass} disabled={!!filters.neverLoggedIn} value={filters.lastLoginTo} onChange={(e) => setFilter({ lastLoginTo: e.target.value })} />
                </div>
              </div>
              <div className="flex flex-col justify-end gap-2">
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-teal-600"
                    checked={!!filters.neverLoggedIn}
                    onChange={(e) => setFilter({ neverLoggedIn: e.target.checked ? "1" : "", lastLoginFrom: "", lastLoginTo: "" })}
                  />
                  Never logged in
                </label>
                <button
                  type="button"
                  className="self-start text-sm font-medium text-teal-700 hover:underline dark:text-teal-400"
                  onClick={() => {
                    setSearchDraft("");
                    setFilters({ ...INITIAL_FILTERS, pageSize: filters.pageSize });
                  }}
                >
                  Clear all filters
                </button>
              </div>
            </div>
          ) : null}

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">User ID</th>
                    <SortableTh label="User email" k="email" filters={filters} onSort={toggleSort} />
                    <th className="px-4 py-3">Password</th>
                    <SortableTh label="Last logged in" k="lastLoginAt" filters={filters} onSort={toggleSort} />
                    <SortableTh label="Sign-up date" k="createdAt" filters={filters} onSort={toggleSort} />
                    <SortableTh label="Subscription plan" k="plan" filters={filters} onSort={toggleSort} />
                    <th className="px-4 py-3">Account status</th>
                    <th className="px-4 py-3">Assigned modules</th>
                    <th className="px-4 py-3 text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className={cx("divide-y divide-slate-100 dark:divide-slate-800", loading && list && "opacity-60")}>
                  {!list && loading
                    ? Array.from({ length: 5 }, (_, i) => (
                        <tr key={i}>
                          <td colSpan={9} className="px-4 py-3">
                            <div className="h-5 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                          </td>
                        </tr>
                      ))
                    : null}
                  {list && list.users.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center">
                        <Users className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
                        <p className="mt-2 font-medium text-slate-700 dark:text-slate-200">No users match these filters</p>
                        <p className="text-sm text-slate-500">Try clearing the search or filters.</p>
                      </td>
                    </tr>
                  ) : null}
                  {list?.users.map((u) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      moduleLabels={moduleLabels}
                      totalModules={catalog?.modules.length ?? 0}
                      onAction={(kind) => setDialog({ kind, user: u })}
                      onAudit={() => {
                        setAuditUser(u);
                        setTab("audit");
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {list ? (
              <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-slate-500 dark:text-slate-400">
                  {list.total === 0
                    ? "0 users"
                    : `Showing ${(list.page - 1) * list.pageSize + 1}–${Math.min(list.page * list.pageSize, list.total)} of ${list.total.toLocaleString("en-IN")}`}
                </p>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-slate-500">
                    Rows
                    <select
                      className={cx(selectClass, "py-1")}
                      value={filters.pageSize}
                      onChange={(e) => setFilter({ pageSize: Number(e.target.value) })}
                    >
                      {[10, 25, 50, 100].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className={cx(btnSecondary, "px-3 py-1")} disabled={list.page <= 1} onClick={() => setFilter({ page: list.page - 1 })}>
                    Previous
                  </button>
                  <span className="tabular-nums text-slate-600 dark:text-slate-300">
                    {list.page} / {list.pageCount}
                  </span>
                  <button
                    type="button"
                    className={cx(btnSecondary, "px-3 py-1")}
                    disabled={list.page >= list.pageCount}
                    onClick={() => setFilter({ page: list.page + 1 })}
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      )}

      {dialog?.kind === "status" ? (
        <StatusDialog user={dialog.user} onClose={() => setDialog(null)} onDone={afterMutation} onError={(m) => setToast({ kind: "error", message: m })} />
      ) : null}
      {dialog?.kind === "plan" ? (
        <PlanDialog
          user={dialog.user}
          plans={plans}
          onClose={() => setDialog(null)}
          onDone={afterMutation}
          onError={(m) => setToast({ kind: "error", message: m })}
        />
      ) : null}
      {dialog?.kind === "modules" && catalog ? (
        <ModulesDialog
          user={dialog.user}
          plans={plans}
          catalog={catalog}
          onClose={() => setDialog(null)}
          onDone={afterMutation}
          onError={(m) => setToast({ kind: "error", message: m })}
        />
      ) : null}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

function SortableTh({ label, k, filters, onSort }: { label: string; k: SortKey; filters: Filters; onSort: (k: SortKey) => void }) {
  const active = filters.sort === k;
  const Icon = active ? (filters.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className="px-4 py-3" aria-sort={active ? (filters.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(k)} className="inline-flex items-center gap-1 uppercase hover:text-slate-800 dark:hover:text-slate-200">
        {label}
        <Icon className={cx("h-3.5 w-3.5", !active && "opacity-40")} aria-hidden />
      </button>
    </th>
  );
}

function UserRow({
  user: u,
  moduleLabels,
  totalModules,
  onAction,
  onAudit,
}: {
  user: AdminUserDTO;
  moduleLabels: Map<string, string>;
  totalModules: number;
  onAction: (kind: "status" | "plan" | "modules") => void;
  onAudit: () => void;
}) {
  const allModules = u.effectiveModules.length >= totalModules && totalModules > 0;
  const moduleTitle = u.effectiveModules.map((k) => moduleLabels.get(k) ?? k).join(", ");
  return (
    <tr className="align-top hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
      <td className="px-4 py-3">
        <code className="break-all font-mono text-[11px] text-slate-500 dark:text-slate-400" title={u.id}>
          {u.id}
        </code>
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-slate-900 dark:text-white">{u.email}</p>
        <p className="text-xs text-slate-500">{u.name}</p>
        {u.isSuperUser ? (
          <span className="mt-1 inline-flex items-center gap-1 rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-800 dark:bg-teal-950 dark:text-teal-200">
            <ShieldCheck className="h-3 w-3" aria-hidden /> Super User
          </span>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 text-slate-400" title="Stored as a one-way hash. Passwords are never displayed.">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          <span aria-label="Password hidden" className="tracking-widest">
            ••••••••
          </span>
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-slate-300">
        {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : <span className="text-slate-400">Never</span>}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-slate-300">{formatDate(u.createdAt)}</td>
      <td className="px-4 py-3">
        {u.isSuperUser ? (
          <span className="text-slate-400">—</span>
        ) : u.plan ? (
          <div className="space-y-1">
            <p className="font-medium text-slate-800 dark:text-slate-100">{u.plan.name}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {u.subscription ? <SubscriptionBadge status={u.subscription.status} /> : null}
              {u.subscription && u.subscription.amount > 0 ? (
                <span className="text-[11px] text-slate-500">
                  {formatInr(u.subscription.amount, 0)}/{u.subscription.billingInterval === "ANNUAL" ? "yr" : "mo"}
                </span>
              ) : null}
            </div>
            {u.subscription?.expiresAt ? <p className="text-[11px] text-slate-500">Until {formatDate(u.subscription.expiresAt)}</p> : null}
          </div>
        ) : (
          <span className="text-slate-500">No plan</span>
        )}
      </td>
      <td className="px-4 py-3">
        <StatusBadge active={u.isActive} />
      </td>
      <td className="max-w-[16rem] px-4 py-3" title={moduleTitle}>
        {allModules ? (
          <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300">
            <LayoutGrid className="h-3.5 w-3.5 text-teal-600" aria-hidden /> All modules ({u.effectiveModules.length})
          </span>
        ) : (
          <div>
            <p className="text-slate-700 dark:text-slate-300">
              {u.effectiveModules.length} of {totalModules}
              {u.moduleAccessRestricted ? <span className="ml-1 text-[11px] text-slate-500">(custom)</span> : null}
            </p>
            <p className="truncate text-[11px] text-slate-500">{moduleTitle}</p>
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <TableRowActions
          actions={[
            {
              label: u.isActive ? "Deactivate user" : "Activate user",
              icon: Power,
              onClick: () => onAction("status"),
              destructive: u.isActive,
              disabled: u.isSuperUser,
            },
            { label: "Change subscription plan", icon: Wallet, onClick: () => onAction("plan"), disabled: u.isSuperUser },
            { label: "Assign / remove modules", icon: LayoutGrid, onClick: () => onAction("modules"), disabled: u.isSuperUser },
            { label: "View audit history", icon: History, onClick: onAudit },
          ]}
        />
      </td>
    </tr>
  );
}

const ACTION_LABEL: Record<string, string> = {
  SUPERUSER_USER_ACTIVATE: "Activated account",
  SUPERUSER_USER_DEACTIVATE: "Deactivated account",
  SUPERUSER_PLAN_CHANGE: "Changed plan",
  SUPERUSER_MODULES_UPDATE: "Updated modules",
  SUPERUSER_USERS_EXPORT: "Exported users",
};

function describeAudit(log: AuditLogDTO, moduleLabels: Map<string, string>): string {
  const m = (log.meta ?? {}) as Record<string, unknown>;
  const label = (k: string) => moduleLabels.get(k) ?? k;
  switch (log.action) {
    case "SUPERUSER_PLAN_CHANGE": {
      const before = m.before as { planName?: string } | null;
      const after = m.after as { planName?: string; billingInterval?: string; amount?: number };
      const dir = typeof m.direction === "string" ? `${m.direction.charAt(0)}${m.direction.slice(1).toLowerCase()}: ` : "";
      return `${dir}${before?.planName ?? "No plan"} → ${after?.planName} (${after?.billingInterval?.toLowerCase()}, ${formatInr(after?.amount ?? 0)})`;
    }
    case "SUPERUSER_MODULES_UPDATE": {
      const after = m.after as { restricted?: boolean };
      if (!after?.restricted) return "Access set to all plan modules";
      const added = (m.added as string[] | undefined) ?? [];
      const removed = (m.removed as string[] | undefined) ?? [];
      const parts = [];
      if (added.length) parts.push(`+ ${added.map(label).join(", ")}`);
      if (removed.length) parts.push(`− ${removed.map(label).join(", ")}`);
      return parts.join(" · ") || "No change";
    }
    case "SUPERUSER_USER_DEACTIVATE":
      return `Active → Inactive; sessions revoked${m.reason ? ` · ${String(m.reason)}` : ""}`;
    case "SUPERUSER_USER_ACTIVATE":
      return `Inactive → Active${m.reason ? ` · ${String(m.reason)}` : ""}`;
    case "SUPERUSER_USERS_EXPORT":
      return plural(Number(m.count ?? 0), "row");
    default:
      return "";
  }
}

function AuditLogPanel({
  filterUser,
  onClearFilter,
  moduleLabels,
}: {
  filterUser: AdminUserDTO | null;
  onClearFilter: () => void;
  moduleLabels: Map<string, string>;
}) {
  // Remounted (via key) when the user filter changes, so page resets naturally.
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState<{ page: number; logs: AuditLogDTO[]; total: number; pageSize: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const data = loaded?.page === page ? loaded : null;

  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (filterUser) q.set("userId", filterUser.id);
    apiJson<{ logs: AuditLogDTO[]; total: number; pageSize: number }>(`/api/superadmin/audit-logs?${q}`)
      .then((d) => {
        if (cancelled) return;
        setLoaded({ page, ...d });
        setError(null);
      })
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [page, filterUser]);

  const pageCount = loaded ? Math.max(1, Math.ceil(loaded.total / loaded.pageSize)) : 1;

  return (
    <section className="space-y-3" aria-label="Audit log">
      {filterUser ? (
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          Showing history for <strong>{filterUser.email}</strong>
          <button type="button" className="font-medium text-teal-700 hover:underline dark:text-teal-400" onClick={onClearFilter}>
            Show all
          </button>
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Super User</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Affected user</th>
                <th className="px-4 py-3">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {!data
                ? Array.from({ length: 4 }, (_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="px-4 py-3">
                        <div className="h-5 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                      </td>
                    </tr>
                  ))
                : null}
              {data && data.logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    No administrative actions recorded yet.
                  </td>
                </tr>
              ) : null}
              {data?.logs.map((l) => (
                <tr key={l.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">{formatDateTime(l.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{l.actor.email}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900 dark:text-white">{ACTION_LABEL[l.action] ?? l.action}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {typeof l.meta?.targetEmail === "string" ? l.meta.targetEmail : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{describeAudit(l, moduleLabels)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && data.total > data.pageSize ? (
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
            <button type="button" className={cx(btnSecondary, "px-3 py-1")} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span className="tabular-nums">
              {page} / {pageCount}
            </span>
            <button type="button" className={cx(btnSecondary, "px-3 py-1")} disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

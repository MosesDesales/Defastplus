"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownLeft,
  BadgePercent,
  BarChart3,
  Building2,
  Calculator,
  Calendar,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  Columns3,
  ClipboardList,
  BookOpen,
  Clock,
  CreditCard,
  FileMinus,
  FileSpreadsheet,
  FileText,
  Files,
  FolderKanban,
  GitBranch,
  Home,
  Landmark,
  Link2,
  Layers,
  Boxes,
  LayoutTemplate,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  Package,
  PieChart,
  Plug,
  Shield,
  Receipt,
  Repeat,
  Ruler,
  Briefcase,
  Settings,
  Scale,
  ShoppingCart,
  SlidersHorizontal,
  Table2,
  Tags,
  Timer,
  User,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ACCOUNTING_MODULES,
  hrefForAccountingSlug,
  hrefForInventorySlug,
  INVENTORY_MODULES,
  MODULES_AFTER_PURCHASES,
  PURCHASES_MODULES,
  type AccountingSlug,
  type InventorySlug,
  type PurchasesSlug,
} from "@/lib/dashboard-nav";
import { hrefForSalesSlug } from "@/lib/sales-nav";
import { SALES_MODULE_ICONS } from "@/lib/sales-module-icons";
import { salesModulesForSettings } from "@/lib/sales-modules";
import { useOrganizationModuleSettings } from "@/components/organization-module-settings-context";

function cx(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

const iconClass = "h-4 w-4 shrink-0 opacity-[0.85]";

const INVENTORY_ICONS: Record<InventorySlug, LucideIcon> = {
  items: Package,
  categories: Tags,
  units: Ruler,
  warehouses: Warehouse,
  "stock-adjustments": Scale,
  valuation: PieChart,
};

const SALES_ICONS = SALES_MODULE_ICONS;

const PURCHASES_ICONS: Record<PurchasesSlug, LucideIcon> = {
  vendors: Building2,
  expenses: Wallet,
  "recurring-expenses": Repeat,
  "purchase-orders": ClipboardList,
  bills: FileSpreadsheet,
  "recurring-bills": Layers,
  "payments-made": ArrowDownLeft,
  "vendor-credits": BadgePercent,
  "purchase-returns": Truck,
};

const ACCOUNTING_ICONS: Record<AccountingSlug, LucideIcon> = {
  "chart-of-accounts": GitBranch,
  "journal-entries": BookOpen,
  "general-ledger": Table2,
  "profit-loss": TrendingUp,
  "balance-sheet": Scale,
  "trial-balance": ListChecks,
  "recurring-journals": Repeat,
  "fixed-assets": Boxes,
  "depreciation": TrendingDown,
};

const MODULE_BOTTOM_ICONS: Record<string, LucideIcon> = {
  "/dashboard/time-tracking": Clock,
  "/dashboard/tasks": ListTodo,
  "/dashboard/banking": Landmark,
  "/dashboard/reports": BarChart3,
  "/dashboard/documents": Files,
};

export function DashboardSidebar() {
  const pathname = usePathname();
  const { settings } = useOrganizationModuleSettings();

  const salesModules = useMemo(() => salesModulesForSettings(settings), [settings]);

  const purchasesModules = useMemo(
    () =>
      PURCHASES_MODULES.filter((m) => {
        if (m.slug === "purchase-orders") return settings.purchaseOrderEnabled;
        if (m.slug === "recurring-expenses") return settings.recurringExpenseEnabled;
        if (m.slug === "recurring-bills") return settings.recurringBillsEnabled;
        if (m.slug === "vendor-credits") return settings.vendorCreditEnabled;
        return true;
      }),
    [settings],
  );

  const accountingModules = useMemo(
    () =>
      ACCOUNTING_MODULES.filter((m) => {
        if (m.slug === "journal-entries") return settings.manualJournalEnabled;
        if (m.slug === "recurring-journals") return settings.recurringJournalEnabled;
        if (m.slug === "fixed-assets" || m.slug === "depreciation") return settings.fixedAssetsEnabled;
        return true;
      }),
    [settings],
  );

  const inventoryModules = useMemo(
    () =>
      INVENTORY_MODULES.filter((m) => {
        if (!settings.inventoryEnabled) return false;
        if (m.slug === "warehouses") return settings.warehousesEnabled;
        return true;
      }),
    [settings],
  );

  const bottomModules = useMemo(
    () =>
      MODULES_AFTER_PURCHASES.filter((m) => {
        if (m.href === "/dashboard/time-tracking") return false;
        if (m.href === "/dashboard/tasks") return false;
        if (m.href === "/dashboard/documents") return settings.ocrEnabled;
        return true;
      }),
    [settings],
  );

  const accountingActive = pathname.startsWith("/dashboard/accounting");
  const inventoryActive = pathname.startsWith("/dashboard/inventory");
  const salesActive = pathname.startsWith("/dashboard/sales");
  const purchasesActive = pathname.startsWith("/dashboard/purchases");
  const gstActive = pathname.startsWith("/dashboard/gst");
  const hrActive = pathname.startsWith("/dashboard/hr");
  const timeTrackingActive =
    pathname.startsWith("/dashboard/time-tracking") ||
    pathname === "/time-tracking" ||
    pathname.startsWith("/time-tracking/");
  const tasksActive =
    pathname.startsWith("/dashboard/tasks") ||
    pathname === "/tasks" ||
    pathname.startsWith("/tasks/");
  const settingsActive =
    pathname.startsWith("/dashboard/settings") ||
    pathname === "/settings/profile" ||
    pathname.startsWith("/settings/") ||
    pathname === "/settings/general";
  const integrationsActive =
    pathname.startsWith("/dashboard/integrations") || pathname.startsWith("/integrations/");

  const [accountingOpen, setAccountingOpen] = useState(accountingActive);
  const [inventoryOpen, setInventoryOpen] = useState(inventoryActive);
  const [salesOpen, setSalesOpen] = useState(salesActive);
  const [purchasesOpen, setPurchasesOpen] = useState(purchasesActive);
  const [gstOpen, setGstOpen] = useState(gstActive);
  const [hrOpen, setHrOpen] = useState(hrActive);
  const [timeTrackingOpen, setTimeTrackingOpen] = useState(timeTrackingActive);
  const [tasksOpen, setTasksOpen] = useState(tasksActive);
  const [settingsOpen, setSettingsOpen] = useState(settingsActive);
  const [integrationsOpen, setIntegrationsOpen] = useState(integrationsActive);

  useEffect(() => {
    if (accountingActive) setAccountingOpen(true);
  }, [accountingActive]);

  useEffect(() => {
    if (inventoryActive) setInventoryOpen(true);
  }, [inventoryActive]);

  useEffect(() => {
    if (salesActive) setSalesOpen(true);
  }, [salesActive]);

  useEffect(() => {
    if (purchasesActive) setPurchasesOpen(true);
  }, [purchasesActive]);

  useEffect(() => {
    if (gstActive) setGstOpen(true);
  }, [gstActive]);

  useEffect(() => {
    if (hrActive) setHrOpen(true);
  }, [hrActive]);

  useEffect(() => {
    if (timeTrackingActive) setTimeTrackingOpen(true);
  }, [timeTrackingActive]);

  useEffect(() => {
    if (tasksActive) setTasksOpen(true);
  }, [tasksActive]);

  useEffect(() => {
    if (settingsActive) setSettingsOpen(true);
  }, [settingsActive]);

  useEffect(() => {
    if (integrationsActive) setIntegrationsOpen(true);
  }, [integrationsActive]);

  const linkClass = useMemo(
    () => (href: string, nested?: boolean) =>
      cx(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
        nested ? "pl-7" : "font-medium",
        pathname === href
          ? "bg-teal-50 text-teal-900 shadow-[inset_3px_0_0_0_rgb(13_148_136)] dark:bg-teal-950/50 dark:text-teal-100 dark:shadow-[inset_3px_0_0_0_rgb(45_212_191)]"
          : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
      ),
    [pathname],
  );

  const nestedHrefActive = useMemo(
    () => (href: string) => {
      const normPath = (() => {
        const p = (pathname || "/").replace(/\/$/, "") || "/";
        if (p === "/time-tracking" || p.startsWith("/time-tracking/")) {
          return "/dashboard/time-tracking" + (p === "/time-tracking" ? "" : p.slice("/time-tracking".length));
        }
        if (p === "/tasks" || p.startsWith("/tasks/")) {
          return "/dashboard/tasks" + (p === "/tasks" ? "" : p.slice("/tasks".length));
        }
        return pathname;
      })();
      const normHref = (h: string) => {
        const x = h.replace(/\/$/, "") || "/";
        if (x === "/time-tracking" || x.startsWith("/time-tracking/")) {
          return "/dashboard/time-tracking" + (x === "/time-tracking" ? "" : x.slice("/time-tracking".length));
        }
        if (x === "/tasks" || x.startsWith("/tasks/")) {
          return "/dashboard/tasks" + (x === "/tasks" ? "" : x.slice("/tasks".length));
        }
        return h;
      };
      const hrefN = normHref(href);
      if (href === "/settings/profile" || href === "/dashboard/settings/profile") {
        return normPath === "/settings/profile" || normPath === "/dashboard/settings/profile";
      }
      if (href === "/dashboard/settings/taxes/gst") {
        return normPath.startsWith("/dashboard/settings/taxes");
      }
      if (href === "/settings/templates") {
        return normPath.startsWith("/settings/templates") || normPath.startsWith("/dashboard/settings/templates");
      }
      if (href === "/settings/general") {
        return normPath === "/settings/general" || normPath === "/dashboard/settings/general";
      }
      if (href.startsWith("/dashboard/integrations")) {
        const pi = normPath.startsWith("/integrations") ? `/dashboard${normPath}` : normPath;
        return pi === href || pi.startsWith(`${href}/`);
      }
      return normPath === hrefN || normPath.startsWith(`${hrefN}/`);
    },
    [pathname],
  );

  const nestedLinkClass = useMemo(
    () => (href: string) =>
      cx(
        "flex items-center gap-2 rounded-lg py-2 pl-7 pr-3 text-sm transition",
        nestedHrefActive(href)
          ? "bg-teal-50 font-medium text-teal-900 shadow-[inset_3px_0_0_0_rgb(13_148_136)] dark:bg-teal-950/50 dark:text-teal-100 dark:shadow-[inset_3px_0_0_0_rgb(45_212_191)]"
          : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
      ),
    [nestedHrefActive],
  );

  const parentRowClass = (active: boolean) =>
    cx(
      "flex flex-1 items-center gap-2 px-3 py-2 text-sm font-medium transition",
      active
        ? "bg-teal-50 text-teal-900 dark:bg-teal-950/50 dark:text-teal-100"
        : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
    );

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:fixed lg:left-0 lg:top-[4.5rem] lg:z-30 lg:h-[calc(100vh-4.5rem)] lg:w-56 lg:overflow-y-auto lg:border-b-0 lg:border-r">
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        <Link href="/dashboard" className={linkClass("/dashboard")}>
          <Home className={iconClass} aria-hidden />
          Home
        </Link>

        {settings.inventoryEnabled ? (
        <div className="pt-2">
          <div className="flex items-stretch overflow-hidden rounded-lg">
            <Link href="/dashboard/inventory" className={parentRowClass(pathname === "/dashboard/inventory")}>
              <Package className={iconClass} aria-hidden />
              Inventory
            </Link>
            <button
              type="button"
              onClick={() => setInventoryOpen((o) => !o)}
              className="shrink-0 px-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-expanded={inventoryOpen}
              aria-label={inventoryOpen ? "Collapse inventory menu" : "Expand inventory menu"}
            >
              {inventoryOpen ? "▾" : "▸"}
            </button>
          </div>
          {inventoryOpen ? (
            <div className="mt-0.5 flex flex-col gap-0.5 border-l border-slate-200 py-1 pl-1 dark:border-slate-700">
              {inventoryModules.map((m) => {
                const href = hrefForInventorySlug(m.slug);
                const Icon = INVENTORY_ICONS[m.slug];
                return (
                  <Link key={m.slug} href={href} className={nestedLinkClass(href)}>
                    <Icon className={iconClass} aria-hidden />
                    {m.label}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
        ) : null}

        <div className="pt-2">
          <div className="flex items-stretch overflow-hidden rounded-lg">
            <Link href="/dashboard/sales" className={parentRowClass(pathname === "/dashboard/sales")}>
              <ShoppingCart className={iconClass} aria-hidden />
              Sales
            </Link>
            <button
              type="button"
              onClick={() => setSalesOpen((o) => !o)}
              className="shrink-0 px-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-expanded={salesOpen}
              aria-label={salesOpen ? "Collapse sales menu" : "Expand sales menu"}
            >
              {salesOpen ? "▾" : "▸"}
            </button>
          </div>
          {salesOpen ? (
            <div className="mt-0.5 flex flex-col gap-0.5 border-l border-slate-200 py-1 pl-1 dark:border-slate-700">
              {salesModules.map((s) => {
                const href = hrefForSalesSlug(s.slug);
                const Icon = SALES_ICONS[s.slug];
                return (
                  <Link key={s.slug} href={href} className={nestedLinkClass(href)}>
                    <Icon className={iconClass} aria-hidden />
                    {s.label}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>

        <div>
          <div className="flex items-stretch overflow-hidden rounded-lg">
            <Link href="/dashboard/purchases" className={parentRowClass(pathname === "/dashboard/purchases")}>
              <Truck className={iconClass} aria-hidden />
              Purchases
            </Link>
            <button
              type="button"
              onClick={() => setPurchasesOpen((o) => !o)}
              className="shrink-0 px-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-expanded={purchasesOpen}
              aria-label={purchasesOpen ? "Collapse purchases menu" : "Expand purchases menu"}
            >
              {purchasesOpen ? "▾" : "▸"}
            </button>
          </div>
          {purchasesOpen ? (
            <div className="mt-0.5 flex flex-col gap-0.5 border-l border-slate-200 py-1 pl-1 dark:border-slate-700">
              {purchasesModules.map((p) => {
                const href = `/dashboard/purchases/${p.slug}`;
                const Icon = PURCHASES_ICONS[p.slug];
                return (
                  <Link key={p.slug} href={href} className={nestedLinkClass(href)}>
                    <Icon className={iconClass} aria-hidden />
                    {p.label}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="pt-2">
          <div className="flex items-stretch overflow-hidden rounded-lg">
            <Link href="/dashboard/accounting" className={parentRowClass(pathname === "/dashboard/accounting")}>
              <Calculator className={iconClass} aria-hidden />
              Accounting
            </Link>
            <button
              type="button"
              onClick={() => setAccountingOpen((o) => !o)}
              className="shrink-0 px-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-expanded={accountingOpen}
              aria-label={accountingOpen ? "Collapse accounting menu" : "Expand accounting menu"}
            >
              {accountingOpen ? "▾" : "▸"}
            </button>
          </div>
          {accountingOpen ? (
            <div className="mt-0.5 flex flex-col gap-0.5 border-l border-slate-200 py-1 pl-1 dark:border-slate-700">
              {accountingModules.map((m) => {
                const href = hrefForAccountingSlug(m.slug);
                const Icon = ACCOUNTING_ICONS[m.slug];
                return (
                  <Link key={m.slug} href={href} className={nestedLinkClass(href)}>
                    <Icon className={iconClass} aria-hidden />
                    {m.label}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="pt-2">
          <div className="flex items-stretch overflow-hidden rounded-lg">
            <Link href="/dashboard/gst" className={parentRowClass(pathname === "/dashboard/gst")}>
              <BadgePercent className={iconClass} aria-hidden />
              GST
            </Link>
            <button
              type="button"
              onClick={() => setGstOpen((o) => !o)}
              className="shrink-0 px-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-expanded={gstOpen}
              aria-label={gstOpen ? "Collapse GST menu" : "Expand GST menu"}
            >
              {gstOpen ? "▾" : "▸"}
            </button>
          </div>
          {gstOpen ? (
            <div className="mt-0.5 flex flex-col gap-0.5 border-l border-slate-200 py-1 pl-1 dark:border-slate-700">
              <Link href="/dashboard/gst/gstr-2a" className={nestedLinkClass("/dashboard/gst/gstr-2a")}>
                <FileSpreadsheet className={iconClass} aria-hidden />
                GSTR-2A
              </Link>
              <Link href="/dashboard/gst/gstr-3b" className={nestedLinkClass("/dashboard/gst/gstr-3b")}>
                <Landmark className={iconClass} aria-hidden />
                GSTR-3B
              </Link>
              <Link href="/dashboard/gst/eway-bills" className={nestedLinkClass("/dashboard/gst/eway-bills")}>
                <Truck className={iconClass} aria-hidden />
                E-Way Bills
              </Link>
            </div>
          ) : null}
        </div>

        <div className="pt-2">
          <div className="flex items-stretch overflow-hidden rounded-lg">
            <Link href="/dashboard/hr" className={parentRowClass(pathname === "/dashboard/hr")}>
              <Briefcase className={iconClass} aria-hidden />
              HR & Payroll
            </Link>
            <button
              type="button"
              onClick={() => setHrOpen((o) => !o)}
              className="shrink-0 px-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-expanded={hrOpen}
              aria-label={hrOpen ? "Collapse HR menu" : "Expand HR menu"}
            >
              {hrOpen ? "▾" : "▸"}
            </button>
          </div>
          {hrOpen ? (
            <div className="mt-0.5 flex flex-col gap-0.5 border-l border-slate-200 py-1 pl-1 dark:border-slate-700">
              <Link href="/dashboard/hr/employees" className={nestedLinkClass("/dashboard/hr/employees")}>
                <Users className={iconClass} aria-hidden />
                Employees
              </Link>
              <Link href="/dashboard/hr/leave" className={nestedLinkClass("/dashboard/hr/leave")}>
                <CalendarDays className={iconClass} aria-hidden />
                Leave
              </Link>
              {settings.payrollEnabled ? (
                <Link href="/dashboard/hr/payroll" className={nestedLinkClass("/dashboard/hr/payroll")}>
                  <ClipboardList className={iconClass} aria-hidden />
                  Payroll
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>

        {settings.timeTrackingEnabled ? (
          <div className="pt-2">
            <div className="flex items-stretch overflow-hidden rounded-lg">
              <Link href="/time-tracking" className={parentRowClass(timeTrackingActive)}>
                <Clock className={iconClass} aria-hidden />
                Time Tracking
              </Link>
              <button
                type="button"
                onClick={() => setTimeTrackingOpen((o) => !o)}
                className="shrink-0 px-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-expanded={timeTrackingOpen}
                aria-label={timeTrackingOpen ? "Collapse time tracking menu" : "Expand time tracking menu"}
              >
                {timeTrackingOpen ? "▾" : "▸"}
              </button>
            </div>
            {timeTrackingOpen ? (
              <div className="mt-0.5 flex flex-col gap-0.5 border-l border-slate-200 py-1 pl-1 dark:border-slate-700">
                <Link href="/time-tracking" className={nestedLinkClass("/time-tracking")}>
                  <LayoutDashboard className={iconClass} aria-hidden />
                  Dashboard
                </Link>
                <Link href="/time-tracking/projects" className={nestedLinkClass("/time-tracking/projects")}>
                  <FolderKanban className={iconClass} aria-hidden />
                  Projects
                </Link>
                <Link href="/time-tracking/tasks" className={nestedLinkClass("/time-tracking/tasks")}>
                  <ListTodo className={iconClass} aria-hidden />
                  Tasks
                </Link>
                <Link href="/time-tracking/timesheets" className={nestedLinkClass("/time-tracking/timesheets")}>
                  <CalendarDays className={iconClass} aria-hidden />
                  Timesheets
                </Link>
                <Link href="/time-tracking/timer" className={nestedLinkClass("/time-tracking/timer")}>
                  <Timer className={iconClass} aria-hidden />
                  Timer
                </Link>
                <Link href="/time-tracking/approvals" className={nestedLinkClass("/time-tracking/approvals")}>
                  <CheckSquare className={iconClass} aria-hidden />
                  Approvals
                </Link>
                <Link href="/time-tracking/reports" className={nestedLinkClass("/time-tracking/reports")}>
                  <BarChart3 className={iconClass} aria-hidden />
                  Reports
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}

        {settings.tasksEnabled ? (
          <div className="pt-2">
            <div className="flex items-stretch overflow-hidden rounded-lg">
              <Link href="/tasks" className={parentRowClass(tasksActive)}>
                <ListTodo className={iconClass} aria-hidden />
                Tasks
              </Link>
              <button
                type="button"
                onClick={() => setTasksOpen((o) => !o)}
                className="shrink-0 px-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-expanded={tasksOpen}
                aria-label={tasksOpen ? "Collapse tasks menu" : "Expand tasks menu"}
              >
                {tasksOpen ? "▾" : "▸"}
              </button>
            </div>
            {tasksOpen ? (
              <div className="mt-0.5 flex flex-col gap-0.5 border-l border-slate-200 py-1 pl-1 dark:border-slate-700">
                <Link href="/tasks" className={nestedLinkClass("/tasks")}>
                  <LayoutDashboard className={iconClass} aria-hidden />
                  Dashboard
                </Link>
                <Link href="/tasks/all" className={nestedLinkClass("/tasks/all")}>
                  <ListTodo className={iconClass} aria-hidden />
                  All Tasks
                </Link>
                <Link href="/tasks/my" className={nestedLinkClass("/tasks/my")}>
                  <User className={iconClass} aria-hidden />
                  My Tasks
                </Link>
                <Link href="/tasks/projects" className={nestedLinkClass("/tasks/projects")}>
                  <FolderKanban className={iconClass} aria-hidden />
                  Projects
                </Link>
                <Link href="/tasks/board" className={nestedLinkClass("/tasks/board")}>
                  <Columns3 className={iconClass} aria-hidden />
                  Kanban Board
                </Link>
                <Link href="/tasks/calendar" className={nestedLinkClass("/tasks/calendar")}>
                  <Calendar className={iconClass} aria-hidden />
                  Calendar View
                </Link>
                <Link href="/tasks/completed" className={nestedLinkClass("/tasks/completed")}>
                  <CheckCircle2 className={iconClass} aria-hidden />
                  Completed Tasks
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="pt-2">
          <div className="flex items-stretch overflow-hidden rounded-lg">
            <Link href="/dashboard/integrations" className={parentRowClass(integrationsActive)}>
              <Plug className={iconClass} aria-hidden />
              Integrations
            </Link>
            <button
              type="button"
              onClick={() => setIntegrationsOpen((o) => !o)}
              className="shrink-0 px-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-expanded={integrationsOpen}
              aria-label={integrationsOpen ? "Collapse integrations menu" : "Expand integrations menu"}
            >
              {integrationsOpen ? "▾" : "▸"}
            </button>
          </div>
          {integrationsOpen ? (
            <div className="mt-0.5 flex flex-col gap-0.5 border-l border-slate-200 py-1 pl-1 dark:border-slate-700">
              {settings.tallyEnabled || settings.zohoBooksEnabled || settings.quickbooksEnabled ? (
                <>
                  <p className="pl-7 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Books
                  </p>
                  {settings.tallyEnabled ? (
                    <Link href="/dashboard/integrations/tally" className={nestedLinkClass("/dashboard/integrations/tally")}>
                      <FileSpreadsheet className={iconClass} aria-hidden />
                      Tally Integration
                    </Link>
                  ) : null}
                  {settings.zohoBooksEnabled ? (
                    <Link
                      href="/dashboard/integrations/zoho-books"
                      className={nestedLinkClass("/dashboard/integrations/zoho-books")}
                    >
                      <BookOpen className={iconClass} aria-hidden />
                      Zoho Books Integration
                    </Link>
                  ) : null}
                  {settings.quickbooksEnabled ? (
                    <Link
                      href="/dashboard/integrations/quickbooks"
                      className={nestedLinkClass("/dashboard/integrations/quickbooks")}
                    >
                      <Landmark className={iconClass} aria-hidden />
                      QuickBooks Integration
                    </Link>
                  ) : null}
                </>
              ) : (
                <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                  No bookkeeping integrations are enabled. Turn them on under Settings → General.
                </p>
              )}
            </div>
          ) : null}
        </div>

        <div className="pt-2">
          <div className="flex items-stretch overflow-hidden rounded-lg">
            <Link href="/dashboard/settings" className={parentRowClass(settingsActive)}>
              <Settings className={iconClass} aria-hidden />
              Settings
            </Link>
            <button
              type="button"
              onClick={() => setSettingsOpen((o) => !o)}
              className="shrink-0 px-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-expanded={settingsOpen}
              aria-label={settingsOpen ? "Collapse Settings menu" : "Expand Settings menu"}
            >
              {settingsOpen ? "▾" : "▸"}
            </button>
          </div>
          {settingsOpen ? (
            <div className="mt-0.5 flex flex-col gap-0.5 border-l border-slate-200 py-1 pl-1 dark:border-slate-700">
              <Link href="/settings/general" className={nestedLinkClass("/settings/general")}>
                <SlidersHorizontal className={iconClass} aria-hidden />
                General
              </Link>
              <Link href="/settings/profile" className={nestedLinkClass("/settings/profile")}>
                <Building2 className={iconClass} aria-hidden />
                Profile
              </Link>
              <Link href="/dashboard/settings/users" className={nestedLinkClass("/dashboard/settings/users")}>
                <Users className={iconClass} aria-hidden />
                Users
              </Link>
              <Link href="/dashboard/settings/roles" className={nestedLinkClass("/dashboard/settings/roles")}>
                <Shield className={iconClass} aria-hidden />
                Roles
              </Link>
              <Link
                href="/dashboard/settings/taxes/gst"
                className={nestedLinkClass("/dashboard/settings/taxes/gst")}
              >
                <BadgePercent className={iconClass} aria-hidden />
                Taxes
              </Link>
              <Link href="/settings/templates" className={nestedLinkClass("/settings/templates")}>
                <LayoutTemplate className={iconClass} aria-hidden />
                PDF templates
              </Link>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-0.5 pt-2">
          {bottomModules.map((m) => {
            const Icon = MODULE_BOTTOM_ICONS[m.href] ?? BarChart3;
            return (
              <Link key={m.href} href={m.href} className={nestedLinkClass(m.href)}>
                <Icon className={iconClass} aria-hidden />
                {m.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="mt-auto border-t border-slate-200 px-3 py-3 dark:border-slate-700">
        <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          © {new Date().getFullYear()} FASTPLUS
        </p>
      </div>
    </aside>
  );
}

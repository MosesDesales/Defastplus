import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  ALL_MODULE_KEYS,
  MODULES,
  isPathAllowedForModules,
  moduleForPath,
  normalizeAppPath,
} from "@/lib/superadmin/modules";

const APP_DIR = join(process.cwd(), "src", "app");

function collect(dir: string, file: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...collect(p, file));
    else if (name === file) out.push(p);
  }
  return out;
}

/** "src/app/dashboard/sales/invoices/[id]/page.tsx" → "/dashboard/sales/invoices/x" */
function routeOf(file: string): string {
  const segs = relative(APP_DIR, file).split(sep).slice(0, -1);
  return (
    "/" +
    segs
      .filter((s) => !(s.startsWith("(") && s.endsWith(")")))
      .map((s) => (s.startsWith("[") ? "x" : s))
      .join("/")
  );
}

/**
 * Routes deliberately outside module control. Adding a page or API without either mapping
 * it in MODULES or listing it here fails the coverage test, so nothing ships ungated by accident.
 */
const UNGATED_PAGES = new Set([
  "/dashboard/sales",
  "/dashboard/purchases",
  "/dashboard/accounting",
  "/dashboard/inventory",
  "/dashboard/gst",
  "/dashboard/hr",
  "/dashboard/reports",
  "/dashboard/settings/taxes",
  "/dashboard/settings/general",
  "/dashboard/sales/x", // placeholder slugs; the concrete slugs are mapped
]);

describe("module registry", () => {
  it("has unique keys and only absolute path prefixes", () => {
    assert.equal(new Set(ALL_MODULE_KEYS).size, MODULES.length);
    for (const m of MODULES) {
      for (const p of [...m.pages, ...m.apis, ...(m.sharedReads ?? [])]) {
        assert.ok(p.replace(/^=/, "").startsWith("/"), `${m.key}: ${p}`);
      }
      for (const p of m.pages) assert.ok(p.replace(/^=/, "").startsWith("/dashboard"), `${m.key} page ${p}`);
      for (const p of m.apis) assert.ok(p.startsWith("/api/"), `${m.key} api ${p}`);
    }
  });

  it("classifies every dashboard page", () => {
    const missing = collect(join(APP_DIR, "dashboard"), "page.tsx")
      .map(routeOf)
      .filter((r) => !moduleForPath(r) && !UNGATED_PAGES.has(r));
    assert.deepEqual(missing, [], `Unclassified pages — map them in MODULES: ${missing.join(", ")}`);
  });

  it("classifies every API route except auth, cron, shared services, and Super User APIs", () => {
    const missing = collect(join(APP_DIR, "api"), "route.ts")
      .map(routeOf)
      .filter((r) => !moduleForPath(r))
      .filter((r) => !/^\/api\/(auth|cron|superadmin|email\/send|ai\/chat)(\/|$)/.test(r));
    assert.deepEqual(missing, [], `Unclassified APIs — map them in MODULES: ${missing.join(", ")}`);
  });

  it("uses the most specific prefix", () => {
    assert.equal(moduleForPath("/dashboard/banking/reconciliation"), "bank_reconciliation");
    assert.equal(moduleForPath("/dashboard/banking/transactions"), "banking");
    assert.equal(moduleForPath("/dashboard/inventory/items/abc/edit"), "products_services");
    assert.equal(moduleForPath("/dashboard/inventory/warehouses"), "inventory");
    assert.equal(moduleForPath("/dashboard/settings/profile"), "company");
    assert.equal(moduleForPath("/dashboard/settings/taxes/gst"), "gst_config");
    assert.equal(moduleForPath("/dashboard/settings/users"), "settings");
    assert.equal(moduleForPath("/api/purchases/expenses/receipt-ocr"), "ocr");
    assert.equal(moduleForPath("/api/purchases/expenses/abc"), "expenses");
    assert.equal(moduleForPath("/dashboard/reports/fixed-asset-register"), "fixed_assets");
  });

  it("matches exact prefixes only exactly", () => {
    assert.equal(moduleForPath("/dashboard"), "dashboard");
    assert.equal(moduleForPath("/dashboard/"), "dashboard");
    assert.equal(moduleForPath("/dashboard/unknown-area"), null);
  });

  it("resolves next.config rewrite aliases before matching", () => {
    assert.equal(normalizeAppPath("/tasks/board"), "/dashboard/tasks/board");
    assert.equal(normalizeAppPath("/settings/templates/invoice"), "/dashboard/settings/templates/invoice");
    assert.equal(moduleForPath("/time-tracking/timer"), "time_tracking");
    assert.equal(moduleForPath("/settings/profile"), "company");
    assert.equal(moduleForPath("/api/journals/j1/post"), "manual_journal");
    assert.equal(moduleForPath("/api/credit-notes"), "credit_debit_notes");
    assert.equal(moduleForPath("/api/currencies"), "settings");
  });

  it("leaves auth, cron and Super User APIs to their own guards", () => {
    for (const p of ["/api/auth/login", "/api/cron/recurring-sales", "/api/superadmin/users", "/api/email/send"]) {
      assert.equal(moduleForPath(p), null, p);
    }
  });
});

describe("isPathAllowedForModules", () => {
  const only = (...keys: string[]) => new Set(keys);

  it("blocks pages and APIs of unassigned modules", () => {
    const s = only("dashboard", "customers");
    assert.equal(isPathAllowedForModules("/dashboard/sales/customers", s), true);
    assert.equal(isPathAllowedForModules("/dashboard/sales/invoices", s), false);
    assert.equal(isPathAllowedForModules("/dashboard/sales/invoices/new", s), false);
    assert.equal(isPathAllowedForModules("/api/gst/gstr3b", s), false);
    assert.equal(isPathAllowedForModules("/dashboard/gst/eway-bills/123", s), false);
    assert.equal(isPathAllowedForModules("/api/gst/eway-bills/123/generate", s, "POST"), false);
  });

  it("allows shared reference-data reads but not writes", () => {
    const s = only("dashboard", "sales_invoices");
    assert.equal(isPathAllowedForModules("/api/customers", s, "GET"), true);
    assert.equal(isPathAllowedForModules("/api/customers", s, "POST"), false);
    assert.equal(isPathAllowedForModules("/api/items", s, "GET"), true);
    assert.equal(isPathAllowedForModules("/api/items/abc", s, "DELETE"), false);
    assert.equal(isPathAllowedForModules("/dashboard/sales/customers", s), false);
    // Non-shared module APIs stay blocked for reads too.
    assert.equal(isPathAllowedForModules("/api/hr/payroll", s, "GET"), false);
  });

  it("opens hub pages only when a module beneath them is assigned", () => {
    assert.equal(isPathAllowedForModules("/dashboard/gst", only("dashboard")), false);
    assert.equal(isPathAllowedForModules("/dashboard/gst", only("dashboard", "gstr3b")), true);
    assert.equal(isPathAllowedForModules("/dashboard/reports", only("dashboard", "profit_loss")), true);
    assert.equal(isPathAllowedForModules("/dashboard/settings/taxes", only("dashboard", "gst_tax_rates")), true);
  });

  it("always allows the dashboard home, general settings, and unmapped paths", () => {
    const s = only("dashboard");
    assert.equal(isPathAllowedForModules("/dashboard", s), true);
    assert.equal(isPathAllowedForModules("/dashboard/settings/general", s), true);
    assert.equal(isPathAllowedForModules("/settings/general", s), true);
    assert.equal(isPathAllowedForModules("/api/auth/me", s), true);
  });
});

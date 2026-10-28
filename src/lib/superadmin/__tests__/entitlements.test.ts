import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeEffectiveModules,
  effectiveSubscriptionStatus,
  formatInr,
  isPaidSubscription,
  modulesOutsidePlan,
  monthlyRevenueOf,
  planModuleKeys,
  type SubscriptionLike,
  type UserAccessInput,
} from "@/lib/superadmin/entitlements";
import { ALL_MODULE_KEYS } from "@/lib/superadmin/modules";

const NOW = new Date("2026-10-20T10:00:00Z");
const past = new Date("2026-10-01T00:00:00Z");
const future = new Date("2026-12-01T00:00:00Z");

const starterPlan = { modules: ["sales_invoices", "customers", "gstr3b"], isFree: false };
const freePlan = { modules: ["customers"], isFree: true };

function sub(over: Partial<SubscriptionLike> = {}): SubscriptionLike {
  return { status: "ACTIVE", billingInterval: "MONTHLY", amount: 499, expiresAt: null, trialEndsAt: null, plan: starterPlan, ...over };
}

function user(over: Partial<UserAccessInput> = {}): UserAccessInput {
  return { isSuperUser: false, moduleAccessRestricted: false, assignedModules: [], subscription: null, ...over };
}

const sorted = (s: Set<string>) => [...s].sort();

describe("computeEffectiveModules", () => {
  it("gives legacy accounts without a subscription every module", () => {
    assert.equal(computeEffectiveModules(user(), null, NOW).size, ALL_MODULE_KEYS.length);
  });

  it("gives Super Users every module regardless of plan", () => {
    const m = computeEffectiveModules(user({ isSuperUser: true, subscription: sub(), moduleAccessRestricted: true }), null, NOW);
    assert.equal(m.size, ALL_MODULE_KEYS.length);
  });

  it("limits to plan modules plus required ones", () => {
    const m = computeEffectiveModules(user({ subscription: sub() }), null, NOW);
    assert.deepEqual(sorted(m), ["customers", "dashboard", "gstr3b", "sales_invoices"]);
  });

  it("intersects custom assignments with the plan", () => {
    const m = computeEffectiveModules(
      user({ subscription: sub(), moduleAccessRestricted: true, assignedModules: ["gstr3b", "payroll"] }),
      null,
      NOW,
    );
    assert.deepEqual(sorted(m), ["dashboard", "gstr3b"]);
  });

  it("falls back to the free plan when the subscription has expired", () => {
    const m = computeEffectiveModules(user({ subscription: sub({ expiresAt: past }) }), freePlan, NOW);
    assert.deepEqual(sorted(m), ["customers", "dashboard"]);
  });

  it("keeps only required modules when expired and no free plan exists", () => {
    const m = computeEffectiveModules(user({ subscription: sub({ status: "CANCELLED" }) }), null, NOW);
    assert.deepEqual(sorted(m), ["dashboard"]);
  });

  it("ignores unknown module keys", () => {
    const m = computeEffectiveModules(user({ moduleAccessRestricted: true, assignedModules: ["not_a_module", "tasks"] }), null, NOW);
    assert.deepEqual(sorted(m), ["dashboard", "tasks"]);
  });
});

describe("subscription status and revenue", () => {
  it("expires trials and paid plans by date", () => {
    assert.equal(effectiveSubscriptionStatus({ status: "TRIAL", trialEndsAt: future, expiresAt: null }, NOW), "TRIAL");
    assert.equal(effectiveSubscriptionStatus({ status: "TRIAL", trialEndsAt: past, expiresAt: null }, NOW), "EXPIRED");
    assert.equal(effectiveSubscriptionStatus({ status: "ACTIVE", trialEndsAt: null, expiresAt: past }, NOW), "EXPIRED");
    assert.equal(effectiveSubscriptionStatus({ status: "ACTIVE", trialEndsAt: null, expiresAt: future }, NOW), "ACTIVE");
  });

  it("counts only active, paid, non-free subscriptions as revenue", () => {
    assert.equal(isPaidSubscription(sub(), NOW), true);
    assert.equal(isPaidSubscription(sub({ plan: freePlan, amount: 0 }), NOW), false);
    assert.equal(isPaidSubscription(sub({ status: "TRIAL", amount: 0 }), NOW), false);
    assert.equal(isPaidSubscription(sub({ expiresAt: past }), NOW), false);
  });

  it("spreads annual billing over 12 months", () => {
    assert.equal(monthlyRevenueOf(sub({ amount: 1499 }), NOW), 1499);
    assert.equal(monthlyRevenueOf(sub({ billingInterval: "ANNUAL", amount: 14990 }), NOW), 1249.17);
    assert.equal(monthlyRevenueOf(sub({ expiresAt: past }), NOW), 0);
  });

  it("formats rupees with Indian digit grouping", () => {
    assert.equal(formatInr(149900), "₹1,49,900.00");
    assert.equal(formatInr(1249.17, 0), "₹1,249");
  });
});

describe("plan restrictions", () => {
  it("expands '*' to every module", () => {
    assert.equal(planModuleKeys(["*"]).length, ALL_MODULE_KEYS.length);
  });

  it("reports modules a plan does not include, never the required ones", () => {
    assert.deepEqual(modulesOutsidePlan(["customers", "payroll", "dashboard"], starterPlan), ["payroll"]);
    assert.deepEqual(modulesOutsidePlan(["payroll"], { modules: ["*"], isFree: false }), []);
    assert.deepEqual(modulesOutsidePlan(["payroll"], null), []);
  });
});

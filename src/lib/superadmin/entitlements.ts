/**
 * Pure entitlement rules (no DB) so they can be unit-tested and shared by the proxy,
 * session checks, and Super User APIs.
 *
 * effective = required ∪ (planModules ∩ assignedModules)
 *   - no subscription        → planModules = every module (legacy accounts keep full access)
 *   - subscription lapsed     → planModules = fallback (free plan) modules
 *   - moduleAccessRestricted  → assignedModules = the stored list, else every module
 */
import { ALL_MODULE_KEYS, REQUIRED_MODULE_KEYS, isModuleKey, type ModuleKey } from "@/lib/superadmin/modules";

export type SubscriptionStatusValue = "TRIAL" | "ACTIVE" | "EXPIRED" | "CANCELLED";
export type BillingIntervalValue = "MONTHLY" | "ANNUAL";

export type PlanLike = { modules: string[]; isFree: boolean };

export type SubscriptionLike = {
  status: SubscriptionStatusValue;
  billingInterval: BillingIntervalValue;
  amount: number;
  expiresAt: Date | null;
  trialEndsAt: Date | null;
  plan: PlanLike;
};

export type UserAccessInput = {
  isSuperUser: boolean;
  moduleAccessRestricted: boolean;
  assignedModules: string[];
  subscription: SubscriptionLike | null;
};

/** Status after applying trial/expiry dates — a stored ACTIVE row past `expiresAt` is EXPIRED. */
export function effectiveSubscriptionStatus(
  sub: Pick<SubscriptionLike, "status" | "expiresAt" | "trialEndsAt">,
  now: Date = new Date(),
): SubscriptionStatusValue {
  if (sub.status === "CANCELLED" || sub.status === "EXPIRED") return sub.status;
  if (sub.status === "TRIAL" && sub.trialEndsAt && sub.trialEndsAt <= now) return "EXPIRED";
  if (sub.expiresAt && sub.expiresAt <= now) return "EXPIRED";
  return sub.status;
}

/** Expands a plan's module list ("*" = all) to known module keys. */
export function planModuleKeys(modules: readonly string[]): ModuleKey[] {
  if (modules.includes("*")) return [...ALL_MODULE_KEYS];
  return modules.filter(isModuleKey);
}

export function computeEffectiveModules(
  input: UserAccessInput,
  fallbackPlan: PlanLike | null,
  now: Date = new Date(),
): Set<ModuleKey> {
  if (input.isSuperUser) return new Set(ALL_MODULE_KEYS);

  let planKeys: ModuleKey[];
  if (!input.subscription) {
    planKeys = [...ALL_MODULE_KEYS];
  } else {
    const status = effectiveSubscriptionStatus(input.subscription, now);
    if (status === "EXPIRED" || status === "CANCELLED") {
      planKeys = fallbackPlan ? planModuleKeys(fallbackPlan.modules) : [];
    } else {
      planKeys = planModuleKeys(input.subscription.plan.modules);
    }
  }

  const assigned = input.moduleAccessRestricted
    ? new Set(input.assignedModules.filter(isModuleKey))
    : new Set<string>(ALL_MODULE_KEYS);

  const out = new Set<ModuleKey>(REQUIRED_MODULE_KEYS);
  for (const k of planKeys) if (assigned.has(k)) out.add(k);
  return out;
}

/** Module keys in `requested` that the plan does not include (required modules are always fine). */
export function modulesOutsidePlan(requested: readonly string[], plan: PlanLike | null): string[] {
  if (!plan) return [];
  const allowed = new Set<string>([...planModuleKeys(plan.modules), ...REQUIRED_MODULE_KEYS]);
  return requested.filter((k) => !allowed.has(k));
}

/** A subscription that currently generates revenue. */
export function isPaidSubscription(sub: SubscriptionLike, now: Date = new Date()): boolean {
  return !sub.plan.isFree && sub.amount > 0 && effectiveSubscriptionStatus(sub, now) === "ACTIVE";
}

/** Monthly recurring revenue contribution in INR (annual billing spread over 12 months). */
export function monthlyRevenueOf(sub: SubscriptionLike, now: Date = new Date()): number {
  if (!isPaidSubscription(sub, now)) return 0;
  const monthly = sub.billingInterval === "ANNUAL" ? sub.amount / 12 : sub.amount;
  return Math.round(monthly * 100) / 100;
}

export function formatInr(amount: number, fractionDigits = 2): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}

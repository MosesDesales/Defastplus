import { prisma } from "@/lib/prisma";
import { computeEffectiveModules, type PlanLike, type SubscriptionLike } from "@/lib/superadmin/entitlements";
import type { ModuleKey } from "@/lib/superadmin/modules";

export type UserAccessState = {
  isActive: boolean;
  isSuperUser: boolean;
  sessionVersion: number;
  modules: Set<ModuleKey>;
};

/**
 * Short-lived cache consulted by getSession() and the proxy on every request. It lives on
 * globalThis because the proxy and route handlers are separate bundles in one process; a
 * module-level Map would give each its own copy and Super User changes would lag. Other
 * server instances pick changes up within ACCESS_TTL_MS.
 */
const ACCESS_TTL_MS = 5_000;
type AccessCache = {
  users: Map<string, { at: number; state: UserAccessState | null }>;
  fallbackPlan: { at: number; plan: PlanLike | null } | null;
};
const globalForAccess = globalThis as unknown as { __fastplusAccessCache?: AccessCache };
const store: AccessCache = (globalForAccess.__fastplusAccessCache ??= { users: new Map(), fallbackPlan: null });

export function invalidateUserAccess(userId?: string) {
  if (userId) store.users.delete(userId);
  else store.users.clear();
  store.fallbackPlan = null;
}

/** Plan applied when a subscription lapses: the first active free plan. */
async function getFallbackPlan(): Promise<PlanLike | null> {
  const hit = store.fallbackPlan;
  if (hit && Date.now() - hit.at < ACCESS_TTL_MS) return hit.plan;
  const row = await prisma.subscriptionPlan.findFirst({
    where: { isFree: true, isActive: true, trialDays: 0 },
    orderBy: { sortOrder: "asc" },
    select: { modules: true, isFree: true },
  });
  store.fallbackPlan = { at: Date.now(), plan: row };
  return row;
}

export function toSubscriptionLike(
  s: {
    status: SubscriptionLike["status"];
    billingInterval: SubscriptionLike["billingInterval"];
    amount: { toString(): string } | number;
    expiresAt: Date | null;
    trialEndsAt: Date | null;
    plan: PlanLike;
  } | null,
): SubscriptionLike | null {
  if (!s) return null;
  return {
    status: s.status,
    billingInterval: s.billingInterval,
    amount: Number(s.amount.toString()),
    expiresAt: s.expiresAt,
    trialEndsAt: s.trialEndsAt,
    plan: { modules: s.plan.modules, isFree: s.plan.isFree },
  };
}

/** null when the user no longer exists. */
export async function getUserAccessState(userId: string, opts?: { fresh?: boolean }): Promise<UserAccessState | null> {
  const hit = store.users.get(userId);
  if (!opts?.fresh && hit && Date.now() - hit.at < ACCESS_TTL_MS) return hit.state;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isActive: true,
      isSuperUser: true,
      sessionVersion: true,
      moduleAccessRestricted: true,
      assignedModules: true,
      subscription: {
        select: {
          status: true,
          billingInterval: true,
          amount: true,
          expiresAt: true,
          trialEndsAt: true,
          plan: { select: { modules: true, isFree: true } },
        },
      },
    },
  });

  let state: UserAccessState | null = null;
  if (user) {
    const fallback = user.subscription ? await getFallbackPlan() : null;
    state = {
      isActive: user.isActive,
      isSuperUser: user.isSuperUser,
      sessionVersion: user.sessionVersion,
      modules: computeEffectiveModules(
        {
          isSuperUser: user.isSuperUser,
          moduleAccessRestricted: user.moduleAccessRestricted,
          assignedModules: user.assignedModules,
          subscription: toSubscriptionLike(user.subscription),
        },
        fallback,
      ),
    };
  }
  store.users.set(userId, { at: Date.now(), state });
  return state;
}

/**
 * Access state for a session token, or null when the session must be rejected. A cached
 * rejection is always confirmed against the database, so a stale entry can never sign out
 * a user who just signed in again (e.g. right after reactivation).
 */
export async function getSessionAccessState(userId: string, tokenSessionVersion: number): Promise<UserAccessState | null> {
  const cached = await getUserAccessState(userId);
  if (isSessionCurrent(cached, tokenSessionVersion)) return cached;
  const fresh = await getUserAccessState(userId, { fresh: true });
  return isSessionCurrent(fresh, tokenSessionVersion) ? fresh : null;
}

/** A session is valid while the user exists, is active, and the token's version is current. */
export function isSessionCurrent(state: UserAccessState | null, tokenSessionVersion: number): state is UserAccessState {
  return Boolean(state && state.isActive && state.sessionVersion === tokenSessionVersion);
}

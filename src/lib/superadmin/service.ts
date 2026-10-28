import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { invalidateUserAccess, toSubscriptionLike } from "@/lib/superadmin/access";
import {
  computeEffectiveModules,
  effectiveSubscriptionStatus,
  modulesOutsidePlan,
  type PlanLike,
} from "@/lib/superadmin/entitlements";
import { ALL_MODULE_KEYS, REQUIRED_MODULE_KEYS, isModuleKey, moduleLabel } from "@/lib/superadmin/modules";
import type { UserListQuery } from "@/lib/superadmin/validators";

export class SuperAdminError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** Audit actions written by this module; all use entity "User" with entityId = affected user. */
export const AUDIT_ACTIONS = {
  activate: "SUPERUSER_USER_ACTIVATE",
  deactivate: "SUPERUSER_USER_DEACTIVATE",
  plan: "SUPERUSER_PLAN_CHANGE",
  modules: "SUPERUSER_MODULES_UPDATE",
  export: "SUPERUSER_USERS_EXPORT",
} as const;

/** Never includes passwordHash or permissions — this is the only shape that leaves the server. */
const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  isSuperUser: true,
  isActive: true,
  deactivatedAt: true,
  lastLoginAt: true,
  createdAt: true,
  moduleAccessRestricted: true,
  assignedModules: true,
  subscription: {
    select: {
      status: true,
      billingInterval: true,
      amount: true,
      startsAt: true,
      expiresAt: true,
      trialEndsAt: true,
      plan: { select: { id: true, code: true, name: true, isFree: true, modules: true } },
    },
  },
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

export type AdminUserDTO = {
  id: string;
  email: string;
  name: string;
  isSuperUser: boolean;
  isActive: boolean;
  deactivatedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  plan: { id: string; code: string; name: string; isFree: boolean } | null;
  subscription: {
    status: string;
    storedStatus: string;
    billingInterval: string;
    amount: number;
    startsAt: string;
    expiresAt: string | null;
    trialEndsAt: string | null;
  } | null;
  moduleAccessRestricted: boolean;
  assignedModules: string[];
  effectiveModules: string[];
};

async function fallbackPlan(): Promise<PlanLike | null> {
  return prisma.subscriptionPlan.findFirst({
    where: { isFree: true, isActive: true, trialDays: 0 },
    orderBy: { sortOrder: "asc" },
    select: { modules: true, isFree: true },
  });
}

function toDTO(u: UserRow, fallback: PlanLike | null, now: Date): AdminUserDTO {
  const sub = u.subscription;
  const effective = computeEffectiveModules(
    {
      isSuperUser: u.isSuperUser,
      moduleAccessRestricted: u.moduleAccessRestricted,
      assignedModules: u.assignedModules,
      subscription: toSubscriptionLike(sub),
    },
    fallback,
    now,
  );
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    isSuperUser: u.isSuperUser,
    isActive: u.isActive,
    deactivatedAt: u.deactivatedAt?.toISOString() ?? null,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    plan: sub ? { id: sub.plan.id, code: sub.plan.code, name: sub.plan.name, isFree: sub.plan.isFree } : null,
    subscription: sub
      ? {
          status: effectiveSubscriptionStatus(sub, now),
          storedStatus: sub.status,
          billingInterval: sub.billingInterval,
          amount: Number(sub.amount.toString()),
          startsAt: sub.startsAt.toISOString(),
          expiresAt: sub.expiresAt?.toISOString() ?? null,
          trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
        }
      : null,
    moduleAccessRestricted: u.moduleAccessRestricted,
    assignedModules: u.assignedModules.filter(isModuleKey),
    effectiveModules: ALL_MODULE_KEYS.filter((k) => effective.has(k)),
  };
}

const DAY_MS = 86_400_000;

export function buildUserWhere(q: UserListQuery): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [];
  if (q.q) {
    and.push({
      OR: [
        { id: { contains: q.q } },
        { email: { contains: q.q, mode: "insensitive" } },
        { name: { contains: q.q, mode: "insensitive" } },
      ],
    });
  }
  if (q.status) and.push({ isActive: q.status === "active" });
  if (q.plan === "none") and.push({ subscription: { is: null } });
  else if (q.plan) and.push({ subscription: { is: { planId: q.plan } } });

  // Date-only "to" values are inclusive of that whole day.
  if (q.signupFrom || q.signupTo) {
    and.push({
      createdAt: {
        ...(q.signupFrom ? { gte: q.signupFrom } : {}),
        ...(q.signupTo ? { lt: new Date(q.signupTo.getTime() + DAY_MS) } : {}),
      },
    });
  }
  if (q.neverLoggedIn) {
    and.push({ lastLoginAt: null });
  } else if (q.lastLoginFrom || q.lastLoginTo) {
    and.push({
      lastLoginAt: {
        ...(q.lastLoginFrom ? { gte: q.lastLoginFrom } : {}),
        ...(q.lastLoginTo ? { lt: new Date(q.lastLoginTo.getTime() + DAY_MS) } : {}),
      },
    });
  }

  // Users who hold the module by assignment and plan (ignores expiry; required modules match everyone).
  if (q.module && !(REQUIRED_MODULE_KEYS as readonly string[]).includes(q.module)) {
    and.push({
      OR: [
        { isSuperUser: true },
        {
          AND: [
            { OR: [{ moduleAccessRestricted: false }, { assignedModules: { has: q.module } }] },
            {
              OR: [
                { subscription: { is: null } },
                { subscription: { is: { plan: { modules: { hasSome: [q.module, "*"] } } } } },
              ],
            },
          ],
        },
      ],
    });
  }
  return and.length ? { AND: and } : {};
}

function buildOrderBy(q: UserListQuery): Prisma.UserOrderByWithRelationInput[] {
  const dir = q.dir;
  const primary: Prisma.UserOrderByWithRelationInput =
    q.sort === "email"
      ? { email: dir }
      : q.sort === "lastLoginAt"
        ? { lastLoginAt: { sort: dir, nulls: "last" } }
        : q.sort === "plan"
          ? { subscription: { plan: { sortOrder: dir } } }
          : { createdAt: dir };
  return [primary, { id: "asc" }];
}

export async function listUsers(q: UserListQuery) {
  const where = buildUserWhere(q);
  const now = new Date();
  const [total, rows, fallback] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: USER_SELECT,
      orderBy: buildOrderBy(q),
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    fallbackPlan(),
  ]);
  return {
    users: rows.map((u) => toDTO(u, fallback, now)),
    total,
    page: q.page,
    pageSize: q.pageSize,
    pageCount: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}

export const EXPORT_LIMIT = 10_000;

export async function listUsersForExport(q: UserListQuery) {
  const now = new Date();
  const [rows, fallback] = await Promise.all([
    prisma.user.findMany({ where: buildUserWhere(q), select: USER_SELECT, orderBy: buildOrderBy(q), take: EXPORT_LIMIT }),
    fallbackPlan(),
  ]);
  return rows.map((u) => toDTO(u, fallback, now));
}

export async function getUserDetail(userId: string) {
  const [u, fallback, teamMembers] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT }),
    fallbackPlan(),
    prisma.teamMember.count({ where: { ownerUserId: userId, status: { not: "INACTIVE" } } }),
  ]);
  if (!u) throw new SuperAdminError(404, "User not found");
  return { user: toDTO(u, fallback, new Date()), usage: { users: teamMembers + 1, companies: 1 } };
}

export async function getDashboardStats() {
  const now = new Date();
  const customer = { isSuperUser: false } satisfies Prisma.UserWhereInput;
  const notExpired: Prisma.UserSubscriptionWhereInput = { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
  const paidWhere: Prisma.UserSubscriptionWhereInput = {
    status: "ACTIVE",
    amount: { gt: 0 },
    plan: { isFree: false },
    user: customer,
    AND: [notExpired],
  };

  const [total, active, trial, paid, free, noPlan, revenueByInterval, plans] = await Promise.all([
    prisma.user.count({ where: customer }),
    prisma.user.count({ where: { ...customer, isActive: true } }),
    prisma.userSubscription.count({
      where: {
        status: "TRIAL",
        user: customer,
        AND: [notExpired, { OR: [{ trialEndsAt: null }, { trialEndsAt: { gt: now } }] }],
      },
    }),
    prisma.userSubscription.count({ where: paidWhere }),
    prisma.userSubscription.count({ where: { status: "ACTIVE", plan: { isFree: true }, user: customer, AND: [notExpired] } }),
    prisma.user.count({ where: { ...customer, subscription: { is: null } } }),
    prisma.userSubscription.groupBy({ by: ["billingInterval"], where: paidWhere, _sum: { amount: true } }),
    listPlans(),
  ]);

  let mrr = 0;
  for (const g of revenueByInterval) {
    const sum = Number(g._sum.amount?.toString() ?? 0);
    mrr += g.billingInterval === "ANNUAL" ? sum / 12 : sum;
  }

  return {
    totalUsers: total,
    activeUsers: active,
    inactiveUsers: total - active,
    trialUsers: trial,
    paidSubscribers: paid,
    freePlanUsers: free,
    noPlanUsers: noPlan,
    monthlyRevenue: Math.round(mrr * 100) / 100,
    currency: "INR",
    plans,
    generatedAt: now.toISOString(),
  };
}

export async function listPlans() {
  const rows = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { subscriptions: true } } },
  });
  return rows.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description,
    monthlyPrice: Number(p.monthlyPrice.toString()),
    annualPrice: Number(p.annualPrice.toString()),
    isFree: p.isFree,
    trialDays: p.trialDays,
    maxUsers: p.maxUsers,
    maxCompanies: p.maxCompanies,
    modules: p.modules.includes("*") ? [...ALL_MODULE_KEYS] : p.modules.filter(isModuleKey),
    allModules: p.modules.includes("*"),
    features: p.features,
    subscriberCount: p._count.subscriptions,
  }));
}

/** Loads a manageable target; Super User accounts (including the actor) are not editable here. */
async function loadTarget(tx: Prisma.TransactionClient, actorId: string, userId: string) {
  const u = await tx.user.findUnique({ where: { id: userId }, select: USER_SELECT });
  if (!u) throw new SuperAdminError(404, "User not found");
  if (u.id === actorId) throw new SuperAdminError(403, "You cannot change your own account here.");
  if (u.isSuperUser) throw new SuperAdminError(403, "Super User accounts cannot be managed from this dashboard.");
  return u;
}

function audit(
  tx: Prisma.TransactionClient,
  actorId: string,
  action: string,
  target: { id: string; email: string },
  meta: Record<string, unknown>,
) {
  return tx.auditLog.create({
    data: {
      userId: actorId,
      action,
      entity: "User",
      entityId: target.id,
      meta: { targetUserId: target.id, targetEmail: target.email, ...meta } as Prisma.InputJsonValue,
    },
  });
}

export async function setUserActive(actorId: string, userId: string, active: boolean, reason?: string) {
  await prisma.$transaction(async (tx) => {
    const u = await loadTarget(tx, actorId, userId);
    if (u.isActive === active) return;
    await tx.user.update({
      where: { id: userId },
      data: active
        ? { isActive: true, deactivatedAt: null }
        : // Bumping the version revokes every session token already issued.
          { isActive: false, deactivatedAt: new Date(), sessionVersion: { increment: 1 } },
    });
    await audit(tx, actorId, active ? AUDIT_ACTIONS.activate : AUDIT_ACTIONS.deactivate, u, {
      before: { isActive: u.isActive },
      after: { isActive: active },
      ...(active ? {} : { sessionsRevoked: true }),
      ...(reason ? { reason } : {}),
    });
  });
  invalidateUserAccess(userId);
  return getUserDetail(userId);
}

type SubscriptionChangeInput = {
  planId: string;
  billingInterval: "MONTHLY" | "ANNUAL";
  status: "ACTIVE" | "TRIAL";
  startsAt?: Date;
  expiresAt?: Date | null;
  note?: string;
};

function monthlyEquivalent(amount: number, interval: string) {
  return interval === "ANNUAL" ? amount / 12 : amount;
}

/**
 * Records a plan change. This never charges the customer — there is no payment gateway in
 * this application; the amount is stored for revenue reporting only.
 */
export async function changeSubscription(actorId: string, userId: string, input: SubscriptionChangeInput) {
  await prisma.$transaction(async (tx) => {
    const u = await loadTarget(tx, actorId, userId);
    const plan = await tx.subscriptionPlan.findUnique({ where: { id: input.planId } });
    if (!plan || !plan.isActive) throw new SuperAdminError(400, "Selected plan is not available");

    if (plan.maxUsers != null) {
      const seats = (await tx.teamMember.count({ where: { ownerUserId: userId, status: { not: "INACTIVE" } } })) + 1;
      if (seats > plan.maxUsers) {
        throw new SuperAdminError(
          409,
          `This account has ${seats} users but ${plan.name} allows ${plan.maxUsers}. Deactivate team members first.`,
          { seats, maxUsers: plan.maxUsers },
        );
      }
    }

    const startsAt = input.startsAt ?? new Date();
    const isTrial = input.status === "TRIAL";
    const trialEndsAt = isTrial
      ? (input.expiresAt ?? (plan.trialDays > 0 ? new Date(startsAt.getTime() + plan.trialDays * DAY_MS) : null))
      : null;
    const expiresAt = isTrial ? trialEndsAt : (input.expiresAt ?? null);
    const amount = isTrial || plan.isFree ? 0 : Number((input.billingInterval === "ANNUAL" ? plan.annualPrice : plan.monthlyPrice).toString());

    const before = u.subscription
      ? {
          planCode: u.subscription.plan.code,
          planName: u.subscription.plan.name,
          status: u.subscription.status,
          billingInterval: u.subscription.billingInterval,
          amount: Number(u.subscription.amount.toString()),
          expiresAt: u.subscription.expiresAt?.toISOString() ?? null,
        }
      : null;

    const data = {
      planId: plan.id,
      status: input.status,
      billingInterval: input.billingInterval,
      amount: new Prisma.Decimal(amount),
      startsAt,
      expiresAt,
      trialEndsAt,
      changedById: actorId,
    };
    await tx.userSubscription.upsert({ where: { userId }, create: { userId, ...data }, update: data });

    // Keep explicit assignments within the new plan so stored state matches what is enforced.
    let prunedModules: string[] = [];
    if (u.moduleAccessRestricted) {
      prunedModules = modulesOutsidePlan(u.assignedModules, plan);
      if (prunedModules.length) {
        await tx.user.update({
          where: { id: userId },
          data: { assignedModules: u.assignedModules.filter((k) => !prunedModules.includes(k)) },
        });
      }
    }

    const oldMonthly = before ? monthlyEquivalent(before.amount, before.billingInterval) : null;
    const newMonthly = monthlyEquivalent(amount, input.billingInterval);
    const direction =
      oldMonthly == null ? "ASSIGN" : newMonthly > oldMonthly ? "UPGRADE" : newMonthly < oldMonthly ? "DOWNGRADE" : "CHANGE";

    await audit(tx, actorId, AUDIT_ACTIONS.plan, u, {
      direction,
      before,
      after: {
        planCode: plan.code,
        planName: plan.name,
        status: input.status,
        billingInterval: input.billingInterval,
        amount,
        startsAt: startsAt.toISOString(),
        expiresAt: expiresAt?.toISOString() ?? null,
      },
      ...(prunedModules.length ? { modulesRemovedByPlan: prunedModules } : {}),
      chargeCollected: false,
      ...(input.note ? { note: input.note } : {}),
    });
  });
  invalidateUserAccess(userId);
  return getUserDetail(userId);
}

export async function updateModuleAssignments(actorId: string, userId: string, restricted: boolean, modules: string[]) {
  const unknown = modules.filter((k) => !isModuleKey(k));
  if (unknown.length) throw new SuperAdminError(400, "Unknown modules", { unknown });
  const requested = [...new Set([...modules, ...REQUIRED_MODULE_KEYS])];

  await prisma.$transaction(async (tx) => {
    const u = await loadTarget(tx, actorId, userId);
    if (restricted) {
      const outside = modulesOutsidePlan(requested, u.subscription?.plan ?? null);
      if (outside.length) {
        throw new SuperAdminError(
          400,
          `Not included in the ${u.subscription?.plan.name ?? "current"} plan: ${outside.map(moduleLabel).join(", ")}`,
          { outsidePlan: outside },
        );
      }
    }
    const nextModules = restricted ? ALL_MODULE_KEYS.filter((k) => requested.includes(k)) : [];
    const prev: readonly string[] | null = u.moduleAccessRestricted ? u.assignedModules : null;
    const nextSet: readonly string[] = nextModules;
    await tx.user.update({
      where: { id: userId },
      data: { moduleAccessRestricted: restricted, assignedModules: nextModules },
    });
    await audit(tx, actorId, AUDIT_ACTIONS.modules, u, {
      before: { restricted: u.moduleAccessRestricted, modules: u.assignedModules },
      after: { restricted, modules: nextModules },
      added: restricted ? nextModules.filter((k) => !(prev ?? ALL_MODULE_KEYS).includes(k)) : [],
      removed: restricted ? (prev ?? ALL_MODULE_KEYS).filter((k) => !nextSet.includes(k)) : [],
    });
  });
  invalidateUserAccess(userId);
  return getUserDetail(userId);
}

export async function recordExport(actorId: string, count: number, filters: Record<string, string>) {
  await prisma.auditLog.create({
    data: {
      userId: actorId,
      action: AUDIT_ACTIONS.export,
      entity: "User",
      meta: { count, filters } as Prisma.InputJsonValue,
    },
  });
}

export async function listAuditLogs(opts: { userId?: string; page: number; pageSize: number }) {
  const where: Prisma.AuditLogWhereInput = {
    entity: "User",
    action: { startsWith: "SUPERUSER_" },
    ...(opts.userId ? { entityId: opts.userId } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
      include: { user: { select: { id: true, email: true } } },
    }),
  ]);
  return {
    total,
    page: opts.page,
    pageSize: opts.pageSize,
    logs: rows.map((r) => ({
      id: r.id,
      action: r.action,
      actor: r.user,
      targetUserId: r.entityId,
      meta: r.meta,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

/** Plan limits for a tenant, used to enforce seat limits outside the Super User module. */
export async function getPlanLimits(userId: string) {
  const sub = await prisma.userSubscription.findUnique({
    where: { userId },
    select: { plan: { select: { name: true, maxUsers: true, maxCompanies: true } } },
  });
  return sub ? sub.plan : null;
}

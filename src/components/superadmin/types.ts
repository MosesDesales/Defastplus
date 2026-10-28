import type { AdminUserDTO } from "@/lib/superadmin/service";

export type { AdminUserDTO };

export type PlanDTO = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthlyPrice: number;
  annualPrice: number;
  isFree: boolean;
  trialDays: number;
  maxUsers: number | null;
  maxCompanies: number | null;
  modules: string[];
  allModules: boolean;
  features: string[];
  subscriberCount: number;
};

export type StatsDTO = {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  trialUsers: number;
  paidSubscribers: number;
  freePlanUsers: number;
  noPlanUsers: number;
  monthlyRevenue: number;
  plans: PlanDTO[];
  generatedAt: string;
};

export type ModuleCatalog = {
  modules: Array<{ key: string; label: string; category: "core" | "gst" | "business"; description: string; required: boolean }>;
  unavailable: Array<{ label: string; category: string; note: string }>;
  bundled: Array<{ label: string; category: string; providedBy: string[]; note: string }>;
};

export type UserListResponse = {
  users: AdminUserDTO[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type UserDetailResponse = { user: AdminUserDTO; usage: { users: number; companies: number } };

export type AuditLogDTO = {
  id: string;
  action: string;
  actor: { id: string; email: string };
  targetUserId: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
};

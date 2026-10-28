import { z } from "zod";
import { ALL_MODULE_KEYS } from "@/lib/superadmin/modules";

export const PAGE_SIZES = [10, 25, 50, 100] as const;

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return undefined;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Invalid date" });
      return z.NEVER;
    }
    return d;
  });

export const userListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  /** Plan id, or "none" for accounts without a subscription. */
  plan: z.string().trim().max(64).optional(),
  module: z.enum(ALL_MODULE_KEYS as unknown as [string, ...string[]]).optional(),
  signupFrom: optionalDate,
  signupTo: optionalDate,
  lastLoginFrom: optionalDate,
  lastLoginTo: optionalDate,
  neverLoggedIn: z.enum(["1", "true"]).optional(),
  sort: z.enum(["email", "createdAt", "lastLoginAt", "plan"]).default("createdAt"),
  dir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((n) => (PAGE_SIZES as readonly number[]).includes(n), "Unsupported page size")
    .default(25),
});

export type UserListQuery = z.infer<typeof userListQuerySchema>;

export const userStatusSchema = z.object({
  active: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

export const subscriptionChangeSchema = z
  .object({
    planId: z.string().trim().min(1).max(64),
    billingInterval: z.enum(["MONTHLY", "ANNUAL"]),
    status: z.enum(["ACTIVE", "TRIAL"]).default("ACTIVE"),
    startsAt: z.coerce.date().optional(),
    /** null clears the expiry (open-ended). */
    expiresAt: z.union([z.coerce.date(), z.null()]).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((d) => !d.startsAt || !d.expiresAt || d.expiresAt > d.startsAt, {
    message: "Expiry must be after the activation date",
    path: ["expiresAt"],
  });

export const moduleAssignmentSchema = z.object({
  /** false = user receives every module the plan includes. */
  restricted: z.boolean(),
  modules: z.array(z.string().trim().min(1).max(64)).max(ALL_MODULE_KEYS.length * 2),
});

export const auditQuerySchema = z.object({
  userId: z.string().trim().max(64).optional(),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export function searchParamsToObject(sp: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of sp.entries()) if (v !== "") out[k] = v;
  return out;
}

/** Permission keys: {module}.{action} or `*` for superuser. */
export const PERMISSION_PRESETS: Record<string, string[]> = {
  admin: ["*", "organization.settings.manage"],
  accountant: [
    "dashboard.view",
    "sales.view",
    "sales.*",
    "purchases.view",
    "purchases.*",
    "inventory.view",
    "accounting.*",
    "reports.view",
    "gst.*",
    "time.*",
    "tasks.*",
    "settings.*",
  ],
  "sales-user": ["dashboard.view", "sales.*", "inventory.view", "reports.view"],
  "hr-manager": ["dashboard.view", "hr.*", "payroll.*", "settings.*", "time.approve", "time.view", "tasks.view", "tasks.edit"],
  employee: ["dashboard.view", "tasks.view", "tasks.edit", "time.view"],
};

export function parsePermissionsJson(raw: string | null | undefined): string[] {
  if (!raw || !raw.trim()) return ["*"];
  try {
    const p = JSON.parse(raw) as unknown;
    if (Array.isArray(p) && p.every((x) => typeof x === "string")) return p as string[];
  } catch {
    /* fallthrough */
  }
  return ["*"];
}

/** Super-admin (`*`) or explicit org-level module toggles (not implied by `settings.*`). */
export function canManageOrganizationModuleSettings(userPerms: string[] | undefined): boolean {
  return hasPermission(userPerms, "*") || hasPermission(userPerms, "organization.settings.manage");
}

export function hasPermission(userPerms: string[] | undefined, required: string): boolean {
  const p = userPerms ?? [];
  if (p.includes("*")) return true;
  if (p.includes(required)) return true;
  const top = required.split(".")[0];
  if (top && p.includes(`${top}.*`)) return true;
  const parts = required.split(".");
  if (parts.length >= 2) {
    const mod = parts[0]!;
    const action = parts[parts.length - 1]!;
    if (action === "view" && (p.includes(`${mod}.create`) || p.includes(`${mod}.edit`) || p.includes(`${mod}.delete`))) {
      return true;
    }
  }
  return false;
}

/** Route prefix → minimum permission */
export const ROUTE_PERMISSIONS: Array<{ prefix: string; permission: string }> = [
  { prefix: "/dashboard/gst", permission: "gst.view" },
  { prefix: "/dashboard/hr", permission: "hr.view" },
  { prefix: "/dashboard/time-tracking", permission: "time.view" },
  { prefix: "/time-tracking", permission: "time.view" },
  { prefix: "/dashboard/tasks", permission: "tasks.view" },
  { prefix: "/tasks", permission: "tasks.view" },
  { prefix: "/dashboard/settings", permission: "settings.view" },
  { prefix: "/settings", permission: "settings.view" },
  { prefix: "/dashboard/integrations", permission: "settings.view" },
  { prefix: "/integrations", permission: "settings.view" },
];

export function permissionForPath(pathname: string): string | null {
  for (const { prefix, permission } of ROUTE_PERMISSIONS) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return permission;
  }
  return null;
}

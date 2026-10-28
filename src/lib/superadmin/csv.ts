import { moduleLabel } from "@/lib/superadmin/modules";
import type { AdminUserDTO } from "@/lib/superadmin/service";

/**
 * Explicit column allow-list: only these fields are exported. Credentials, hashes, tokens,
 * and session versions are not part of AdminUserDTO and therefore cannot leak here.
 */
const COLUMNS: Array<[header: string, value: (u: AdminUserDTO) => string]> = [
  ["User ID", (u) => u.id],
  ["Email", (u) => u.email],
  ["Name", (u) => u.name],
  ["Account Status", (u) => (u.isActive ? "Active" : "Inactive")],
  ["Sign-Up Date", (u) => u.createdAt],
  ["Last Logged In", (u) => u.lastLoginAt ?? ""],
  ["Subscription Plan", (u) => u.plan?.name ?? "No plan"],
  ["Subscription Status", (u) => u.subscription?.status ?? ""],
  ["Billing Interval", (u) => u.subscription?.billingInterval ?? ""],
  ["Plan Amount (INR, excl. GST)", (u) => (u.subscription ? u.subscription.amount.toFixed(2) : "")],
  ["Plan Expires", (u) => u.subscription?.expiresAt ?? ""],
  ["Module Access", (u) => (u.moduleAccessRestricted ? "Custom" : "All plan modules")],
  ["Assigned Modules", (u) => u.effectiveModules.map(moduleLabel).join("; ")],
];

/** Quotes a cell and neutralises spreadsheet formula injection (=, +, -, @, tab, CR). */
export function csvCell(raw: string): string {
  const v = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${v.replace(/"/g, '""')}"`;
}

export function usersToCsv(users: AdminUserDTO[]): string {
  const lines = [COLUMNS.map(([h]) => csvCell(h)).join(",")];
  for (const u of users) lines.push(COLUMNS.map(([, f]) => csvCell(f(u))).join(","));
  // BOM so Excel opens UTF-8 (₹, Indian names) correctly.
  return `﻿${lines.join("\r\n")}\r\n`;
}

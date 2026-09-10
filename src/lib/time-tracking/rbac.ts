import { hasPermission } from "@/lib/permissions";

export function canApproveTimesheets(userPerms: string[] | undefined): boolean {
  return (
    hasPermission(userPerms, "*") ||
    hasPermission(userPerms, "time.approve") ||
    hasPermission(userPerms, "hr.*")
  );
}

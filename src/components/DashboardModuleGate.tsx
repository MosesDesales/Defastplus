"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  isDashboardPathAllowedForModules,
  isDashboardPathExemptFromModuleGate,
} from "@/lib/organization-module-settings";
import { useOrganizationModuleSettings } from "@/components/organization-module-settings-context";

export function DashboardModuleGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { settings, loaded, canAccess } = useOrganizationModuleSettings();

  useEffect(() => {
    if (!loaded) return;
    let pathForGate = pathname;
    if (pathname.startsWith("/time-tracking") && !pathname.startsWith("/dashboard/time-tracking")) {
      pathForGate = pathname.replace(/^\/time-tracking/, "/dashboard/time-tracking");
    } else if (pathname.startsWith("/tasks") && !pathname.startsWith("/dashboard/tasks")) {
      pathForGate = pathname.replace(/^\/tasks/, "/dashboard/tasks");
    }
    if (!pathForGate.startsWith("/dashboard")) return;
    if (!canAccess(pathForGate)) {
      router.replace("/dashboard?module=unassigned");
      return;
    }
    if (isDashboardPathExemptFromModuleGate(pathForGate)) return;
    if (!isDashboardPathAllowedForModules(pathForGate, settings)) {
      router.replace("/dashboard?module=disabled");
    }
  }, [loaded, pathname, router, settings, canAccess]);

  return <>{children}</>;
}

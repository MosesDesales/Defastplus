"use client";

import type { ReactNode } from "react";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DashboardModuleGate } from "@/components/DashboardModuleGate";
import { OrganizationModuleSettingsProvider } from "@/components/organization-module-settings-context";

export function DashboardChrome({ children }: { children: ReactNode }) {
  return (
    <OrganizationModuleSettingsProvider>
      <div className="mx-auto flex max-w-[1600px] flex-1 flex-col pt-16 sm:pt-[4.5rem] lg:flex-row">
        <DashboardSidebar />
        <main className="min-h-[calc(100vh-4rem)] min-w-0 flex-1 px-4 py-6 sm:min-h-[calc(100vh-4.5rem)] sm:px-6 lg:ml-56">
          <DashboardModuleGate>{children}</DashboardModuleGate>
        </main>
      </div>
    </OrganizationModuleSettingsProvider>
  );
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_ORGANIZATION_MODULE_SETTINGS,
  type OrganizationModuleSettingsDTO,
} from "@/lib/organization-module-settings";
import { isPathAllowedForModules } from "@/lib/superadmin/modules";

type OrganizationModuleSettingsContextValue = {
  settings: OrganizationModuleSettingsDTO;
  loaded: boolean;
  canManage: boolean;
  refresh: () => Promise<void>;
  /** Modules assigned by the Super User (plan ∩ assignment); null until loaded. */
  assignedModules: ReadonlySet<string> | null;
  isSuperUser: boolean;
  /** Whether a page is open to this user. Allows everything until assignments load (the proxy enforces). */
  canAccess: (href: string) => boolean;
};

const OrganizationModuleSettingsContext = createContext<OrganizationModuleSettingsContextValue | null>(null);

export function OrganizationModuleSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<OrganizationModuleSettingsDTO | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [assignedModules, setAssignedModules] = useState<ReadonlySet<string> | null>(null);
  const [isSuperUser, setIsSuperUser] = useState(false);

  const refresh = useCallback(async () => {
    const [res, meRes] = await Promise.all([
      fetch("/api/settings/general", { cache: "no-store" }),
      fetch("/api/auth/me", { cache: "no-store" }),
    ]);
    if (meRes.ok) {
      const me = (await meRes.json()) as { user: { modules?: string[]; isSuperUser?: boolean } | null };
      if (me.user?.modules) setAssignedModules(new Set(me.user.modules));
      setIsSuperUser(Boolean(me.user?.isSuperUser));
    }
    if (!res.ok) return;
    const json = (await res.json()) as { settings: OrganizationModuleSettingsDTO; canManage?: boolean };
    setSettings(json.settings);
    setCanManage(Boolean(json.canManage));
    setLoaded(true);
  }, []);

  const canAccess = useCallback(
    (href: string) => (assignedModules ? isPathAllowedForModules(href, assignedModules) : true),
    [assignedModules],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<OrganizationModuleSettingsContextValue>(
    () => ({
      settings: settings ?? DEFAULT_ORGANIZATION_MODULE_SETTINGS,
      loaded,
      canManage,
      refresh,
      assignedModules,
      isSuperUser,
      canAccess,
    }),
    [settings, loaded, canManage, refresh, assignedModules, isSuperUser, canAccess],
  );

  return (
    <OrganizationModuleSettingsContext.Provider value={value}>{children}</OrganizationModuleSettingsContext.Provider>
  );
}

export function useOrganizationModuleSettings(): OrganizationModuleSettingsContextValue {
  const ctx = useContext(OrganizationModuleSettingsContext);
  if (!ctx) {
    throw new Error("OrganizationModuleSettingsProvider is required");
  }
  return ctx;
}

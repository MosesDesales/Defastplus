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

type OrganizationModuleSettingsContextValue = {
  settings: OrganizationModuleSettingsDTO;
  loaded: boolean;
  canManage: boolean;
  refresh: () => Promise<void>;
};

const OrganizationModuleSettingsContext = createContext<OrganizationModuleSettingsContextValue | null>(null);

export function OrganizationModuleSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<OrganizationModuleSettingsDTO | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/settings/general", { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as { settings: OrganizationModuleSettingsDTO; canManage?: boolean };
    setSettings(json.settings);
    setCanManage(Boolean(json.canManage));
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<OrganizationModuleSettingsContextValue>(
    () => ({
      settings: settings ?? DEFAULT_ORGANIZATION_MODULE_SETTINGS,
      loaded,
      canManage,
      refresh,
    }),
    [settings, loaded, canManage, refresh],
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

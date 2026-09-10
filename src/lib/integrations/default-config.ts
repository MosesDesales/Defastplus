import { IntegrationType } from "@prisma/client";

export type SyncScopes = {
  chartOfAccounts: boolean;
  customers: boolean;
  vendors: boolean;
  items: boolean;
  salesInvoices: boolean;
  purchaseBills: boolean;
  payments: boolean;
  journals: boolean;
};

export type IntegrationConfig = {
  tallyUrl?: string;
  zohoRedirectUrl?: string;
  scopes: SyncScopes;
};

export const DEFAULT_SCOPES: SyncScopes = {
  chartOfAccounts: true,
  customers: true,
  vendors: true,
  items: true,
  salesInvoices: true,
  purchaseBills: true,
  payments: true,
  journals: false,
};

export const DEFAULT_MAPPING = {
  accounts: [
    { app: "Sales", external: "" },
    { app: "GST / Output tax", external: "" },
  ],
  taxRates: [{ app: "GST 18%", external: "" }],
  items: [{ app: "Default item group", external: "" }],
};

export function defaultConfigFor(type: IntegrationType): IntegrationConfig {
  if (type === IntegrationType.TALLY) {
    return { tallyUrl: "http://localhost:9000", scopes: { ...DEFAULT_SCOPES } };
  }
  if (type === IntegrationType.ZOHO_BOOKS) {
    return {
      zohoRedirectUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard/integrations/zoho-books`,
      scopes: { ...DEFAULT_SCOPES },
    };
  }
  return { scopes: { ...DEFAULT_SCOPES } };
}

export function parseConfigJson(raw: string | null | undefined, type: IntegrationType): IntegrationConfig {
  const base = defaultConfigFor(type);
  if (!raw?.trim()) return base;
  try {
    const j = JSON.parse(raw) as Partial<IntegrationConfig>;
    return {
      ...base,
      ...j,
      scopes: { ...base.scopes, ...(j.scopes ?? {}) },
    };
  } catch {
    return base;
  }
}

export function parseMappingJson(raw: string | null | undefined): typeof DEFAULT_MAPPING {
  if (!raw?.trim()) return structuredClone(DEFAULT_MAPPING);
  try {
    const j = JSON.parse(raw) as typeof DEFAULT_MAPPING;
    return {
      accounts: Array.isArray(j.accounts) ? j.accounts : DEFAULT_MAPPING.accounts,
      taxRates: Array.isArray(j.taxRates) ? j.taxRates : DEFAULT_MAPPING.taxRates,
      items: Array.isArray(j.items) ? j.items : DEFAULT_MAPPING.items,
    };
  } catch {
    return structuredClone(DEFAULT_MAPPING);
  }
}

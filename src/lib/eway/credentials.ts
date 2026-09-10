import { decryptCredentials, encryptCredentials } from "@/lib/integrations/crypto-credentials";

export type EWayGspCredentials = {
  username?: string;
  password?: string;
  gstin?: string;
  clientId?: string;
  clientSecret?: string;
  authToken?: string;
  tokenExpiresAt?: string;
};

export function encryptEWayCredentials(creds: EWayGspCredentials): string {
  return encryptCredentials(creds as Record<string, unknown>);
}

export function decryptEWayCredentials(payload: string | null | undefined): EWayGspCredentials {
  if (!payload?.trim()) return {};
  return decryptCredentials(payload) as EWayGspCredentials;
}

export function maskCredential(value: string | undefined): string {
  if (!value) return "";
  if (value.length <= 4) return "****";
  return `${"*".repeat(Math.min(value.length - 4, 8))}${value.slice(-4)}`;
}

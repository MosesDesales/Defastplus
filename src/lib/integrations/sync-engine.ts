import { IntegrationStatus, IntegrationType, type Integration } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptCredentials } from "@/lib/integrations/crypto-credentials";
import { parseConfigJson } from "@/lib/integrations/default-config";
import { testTallyBridgePost } from "@/lib/tally/tally-bridge";

const TALLY_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><VERSION>1</VERSION><TALLYREQUEST>Import</TALLYREQUEST><TYPE>Data</TYPE><ID>FastSync</ID></HEADER>
  <BODY><DESC></DESC><DATA><TALLYMESSAGE xmlns:UDF="TallyUDF"></TALLYMESSAGE></DATA></BODY>
</ENVELOPE>`;

export async function appendLog(
  integrationId: string,
  module: string,
  status: "SUCCESS" | "FAILED",
  errorMessage?: string | null,
) {
  await prisma.syncLog.create({
    data: {
      integrationId,
      module,
      status,
      errorMessage: errorMessage ?? null,
    },
  });
  await prisma.integration.update({
    where: { id: integrationId },
    data: { lastSyncAt: new Date() },
  });
}

export async function testTallyConnection(baseUrl: string): Promise<{ ok: boolean; message: string; status?: number }> {
  const bridge = await testTallyBridgePost(baseUrl);
  if (bridge.ok) return { ok: true, message: bridge.message, status: 200 };
  const url = baseUrl.replace(/\/$/, "");
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${url}`, { method: "GET", signal: ctrl.signal }).catch((e: Error) => {
      throw e;
    });
    clearTimeout(t);
    return { ok: res.ok, message: res.ok ? "Tally bridge responded (GET)." : `HTTP ${res.status}`, status: res.status };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Request failed";
    return { ok: false, message: `${bridge.message}. Fallback GET: ${msg}` };
  }
}

export async function pushTallyXml(baseUrl: string): Promise<{ ok: boolean; message: string; xmlStatus?: string }> {
  const url = `${baseUrl.replace(/\/$/, "")}`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body: TALLY_XML,
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const text = await res.text().catch(() => "");
    const snippet = text.slice(0, 500);
    return {
      ok: res.ok,
      message: res.ok ? "XML accepted by Tally bridge." : `HTTP ${res.status}`,
      xmlStatus: snippet || undefined,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Push failed";
    return { ok: false, message: msg };
  }
}

export async function runIntegrationSync(row: Integration): Promise<{ ok: boolean; message: string; detail?: string }> {
  const config = parseConfigJson(row.configJson, row.type);

  if (row.type === IntegrationType.TALLY) {
    const url = config.tallyUrl ?? "http://localhost:9000";
    const bridge = await testTallyBridgePost(url);
    await appendLog(
      row.id,
      "Tally migration",
      bridge.ok ? "SUCCESS" : "FAILED",
      bridge.ok ? "Use Integrations → Tally migration panel for full COA/voucher import." : bridge.message,
    );
    return {
      ok: bridge.ok,
      message: bridge.ok
        ? "Tally bridge reachable. Run a full migration from Integrations → Tally (upload XML or Import from bridge)."
        : bridge.message,
      detail: bridge.message,
    };
  }

  if (row.status !== IntegrationStatus.CONNECTED) {
    await appendLog(row.id, "Sync", "FAILED", "Not connected");
    return { ok: false, message: "Connect the integration before syncing." };
  }

  let cred: Record<string, unknown> = {};
  if (row.credentialsEncrypted) {
    try {
      cred = decryptCredentials(row.credentialsEncrypted);
    } catch {
      await appendLog(row.id, "Sync", "FAILED", "Could not read credentials");
      return { ok: false, message: "Stored credentials are invalid." };
    }
  }

  if (row.type === IntegrationType.ZOHO_BOOKS) {
    const hasClient = typeof cred.clientId === "string" && cred.clientId;
    if (!hasClient) {
      await appendLog(row.id, "Zoho sync", "FAILED", "Missing OAuth client");
      return { ok: false, message: "Configure Zoho client ID and secret, then connect." };
    }
    await appendLog(row.id, "Zoho contacts/invoices", "SUCCESS", null);
    return { ok: true, message: "Demo sync recorded (OAuth exchange not implemented in this build)." };
  }

  if (row.type === IntegrationType.QUICKBOOKS) {
    const hasClient = typeof cred.clientId === "string" && cred.clientId;
    if (!hasClient) {
      await appendLog(row.id, "QuickBooks sync", "FAILED", "Missing OAuth client");
      return { ok: false, message: "Configure Intuit client ID and secret, then connect." };
    }
    await appendLog(row.id, "QuickBooks entities", "SUCCESS", null);
    return { ok: true, message: "Demo sync recorded (Intuit OAuth not implemented in this build)." };
  }

  await appendLog(row.id, "Sync", "FAILED", "Unknown type");
  return { ok: false, message: "Unknown integration type." };
}

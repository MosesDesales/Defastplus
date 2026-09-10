import { TallyMigrationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { importTallyCoa } from "@/lib/tally/coa-importer";
import { importTallyInventory } from "@/lib/tally/inventory-importer";
import { reconcileSummary, reconcileTrialBalance } from "@/lib/tally/reconciliation";
import {
  DEFAULT_MIGRATION_PHASES,
  hashTallySource,
  type TallyMigrationPhases,
  type TallyMigrationStats,
} from "@/lib/tally/types";
import { fetchTallyXml, tallyExportGroupsXml, tallyExportLedgersXml, tallyExportStockItemsXml, tallyExportVouchersXml } from "@/lib/tally/tally-bridge";
import { importTallyVouchers } from "@/lib/tally/voucher-importer";
import { parseTallyXml, summarizeParsedExport } from "@/lib/tally/xml-parser";

async function logJob(jobId: string, level: "INFO" | "WARN" | "ERROR", phase: string, message: string, detail?: unknown) {
  await prisma.tallyMigrationLog.create({
    data: {
      jobId,
      level,
      phase,
      message,
      detailJson: detail != null ? JSON.stringify(detail) : null,
    },
  });
}

export async function createMigrationJob(opts: {
  userId: string;
  integrationId?: string | null;
  sourceType: string;
  fileName?: string;
  phases?: Partial<TallyMigrationPhases>;
}) {
  const phases = { ...DEFAULT_MIGRATION_PHASES, ...opts.phases };
  return prisma.tallyMigrationJob.create({
    data: {
      userId: opts.userId,
      integrationId: opts.integrationId ?? null,
      sourceType: opts.sourceType,
      fileName: opts.fileName ?? null,
      phasesJson: JSON.stringify(phases),
      status: TallyMigrationStatus.PENDING,
    },
  });
}

export async function runMigrationJob(jobId: string, xmlContent: string) {
  const job = await prisma.tallyMigrationJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Migration job not found");

  const phases: TallyMigrationPhases = job.phasesJson
    ? { ...DEFAULT_MIGRATION_PHASES, ...JSON.parse(job.phasesJson) }
    : DEFAULT_MIGRATION_PHASES;

  const stats: TallyMigrationStats = {
    groupsImported: 0,
    groupsSkipped: 0,
    ledgersImported: 0,
    ledgersUpdated: 0,
    ledgersSkipped: 0,
    vouchersImported: 0,
    vouchersSkipped: 0,
    vouchersFailed: 0,
    stockItemsImported: 0,
    openingBalanceDelta: 0,
  };

  await prisma.tallyMigrationJob.update({
    where: { id: jobId },
    data: { status: TallyMigrationStatus.PARSING, startedAt: new Date(), errorSummary: null },
  });

  let parsed;
  try {
    parsed = parseTallyXml(xmlContent);
    await prisma.tallyMigrationSnapshot.upsert({
      where: { jobId },
      create: {
        jobId,
        parsedJson: JSON.stringify(summarizeParsedExport(parsed)),
        sourceHash: hashTallySource(xmlContent),
      },
      update: {
        parsedJson: JSON.stringify(summarizeParsedExport(parsed)),
        sourceHash: hashTallySource(xmlContent),
      },
    });
    await logJob(jobId, "INFO", "parse", `Parsed ${parsed.groups.length} groups, ${parsed.ledgers.length} ledgers, ${parsed.vouchers.length} vouchers.`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Parse failed";
    await prisma.tallyMigrationJob.update({
      where: { id: jobId },
      data: { status: TallyMigrationStatus.FAILED, errorSummary: msg, completedAt: new Date() },
    });
    await logJob(jobId, "ERROR", "parse", msg);
    throw e;
  }

  const log = (level: "INFO" | "WARN" | "ERROR", message: string, detail?: unknown) =>
    void logJob(jobId, level, "import", message, detail);

  if (phases.coa) {
    await prisma.tallyMigrationJob.update({ where: { id: jobId }, data: { status: TallyMigrationStatus.IMPORTING_COA } });
    const coa = await importTallyCoa(job.userId, jobId, parsed, log);
    stats.groupsImported = coa.groupsImported;
    stats.groupsSkipped = coa.groupsSkipped;
    stats.ledgersImported = coa.ledgersImported;
    stats.ledgersUpdated = coa.ledgersUpdated;
    stats.ledgersSkipped = coa.ledgersSkipped;
    if (coa.errors.length) await logJob(jobId, "WARN", "coa", `${coa.errors.length} COA errors`, coa.errors.slice(0, 20));
  }

  if (phases.vouchers) {
    await prisma.tallyMigrationJob.update({ where: { id: jobId }, data: { status: TallyMigrationStatus.IMPORTING_VOUCHERS } });
    const vch = await importTallyVouchers(job.userId, jobId, parsed, log);
    stats.vouchersImported = vch.imported;
    stats.vouchersSkipped = vch.skipped;
    stats.vouchersFailed = vch.failed;
    if (vch.errors.length) await logJob(jobId, "WARN", "voucher", `${vch.errors.length} voucher errors`, vch.errors.slice(0, 20));
  }

  if (phases.inventory) {
    await prisma.tallyMigrationJob.update({ where: { id: jobId }, data: { status: TallyMigrationStatus.IMPORTING_INVENTORY } });
    const inv = await importTallyInventory(job.userId, jobId, parsed, log);
    stats.stockItemsImported = inv.imported + inv.updated;
  }

  let reconcileJson: string | null = null;
  if (phases.reconcile) {
    await prisma.tallyMigrationJob.update({ where: { id: jobId }, data: { status: TallyMigrationStatus.RECONCILING } });
    const tb = await reconcileTrialBalance(job.userId, parsed, {
      includeVoucherMovements: phases.vouchers,
    });
    const summary = reconcileSummary(tb.rows);
    reconcileJson = JSON.stringify({ ...tb, summary });
    await logJob(
      jobId,
      tb.balanced ? "INFO" : "WARN",
      "reconcile",
      tb.balanced
        ? `${tb.mode} trial balance matched.`
        : `${summary.mismatches} ledger mismatches (${tb.mode})`,
      summary,
    );
  }

  const hasErrors = stats.vouchersFailed > 0;
  const finalStatus = hasErrors ? TallyMigrationStatus.PARTIAL : TallyMigrationStatus.COMPLETED;

  await prisma.tallyMigrationJob.update({
    where: { id: jobId },
    data: {
      status: finalStatus,
      statsJson: JSON.stringify(stats),
      reconcileJson,
      completedAt: new Date(),
      errorSummary: hasErrors ? `${stats.vouchersFailed} vouchers failed` : null,
    },
  });

  return { stats, reconcile: reconcileJson ? JSON.parse(reconcileJson) : null };
}

export async function fetchFromTallyBridge(userId: string, baseUrl: string): Promise<string> {
  void userId;
  const [groupsRes, ledgersRes, vouchersRes, stockRes] = await Promise.all([
    fetchTallyXml(baseUrl, tallyExportGroupsXml()),
    fetchTallyXml(baseUrl, tallyExportLedgersXml()),
    fetchTallyXml(baseUrl, tallyExportVouchersXml()),
    fetchTallyXml(baseUrl, tallyExportStockItemsXml()),
  ]);
  const parts = [groupsRes, ledgersRes, vouchersRes, stockRes].filter((r) => r.ok && r.xml.trim());
  if (parts.length === 0) {
    throw new Error(groupsRes.message || ledgersRes.message || "Tally export failed");
  }
  return parts.map((r) => r.xml).join("\n");
}

export async function getMigrationJob(userId: string, jobId: string) {
  const job = await prisma.tallyMigrationJob.findFirst({
    where: { id: jobId, userId },
    include: {
      logs: { orderBy: { createdAt: "desc" }, take: 100 },
      snapshot: true,
    },
  });
  return job;
}

export async function listMigrationJobs(userId: string, limit = 20) {
  return prisma.tallyMigrationJob.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { accountCodeFromTallyName, normalizeTallyKey, resolveAccountType } from "@/lib/tally/group-mapping";
import type { TallyParsedExport, TallyParsedGroup, TallyParsedLedger } from "@/lib/tally/types";

type Db = PrismaClient | Prisma.TransactionClient;

export type CoaImportResult = {
  groupsImported: number;
  groupsSkipped: number;
  ledgersImported: number;
  ledgersUpdated: number;
  ledgersSkipped: number;
  errors: string[];
};

type LogFn = (level: "INFO" | "WARN" | "ERROR", message: string, detail?: unknown) => void;

function parentChain(allGroups: Map<string, TallyParsedGroup>, start: string | null): string[] {
  const chain: string[] = [];
  let cur = start;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    chain.push(cur);
    cur = allGroups.get(cur)?.parent ?? null;
  }
  return chain;
}

async function ensureGroupExists(
  db: Db,
  userId: string,
  jobId: string,
  groupName: string,
  parentName: string | null,
  groupMap: Map<string, TallyParsedGroup>,
  accountByTallyKey: Map<string, string>,
  codeSeqRef: { value: number },
  result: CoaImportResult,
  log: LogFn,
): Promise<string | null> {
  const name = normalizeTallyKey(groupName);
  if (!name || name.toLowerCase() === "primary") return null;

  const existingId = accountByTallyKey.get(name);
  if (existingId) return existingId;

  let parentId: string | null = null;
  if (parentName) {
    parentId = await ensureGroupExists(
      db,
      userId,
      jobId,
      parentName,
      groupMap.get(normalizeTallyKey(parentName))?.parent ?? null,
      groupMap,
      accountByTallyKey,
      codeSeqRef,
      result,
      log,
    );
  }

  const chain = parentChain(groupMap, parentName);
  const type = resolveAccountType(name, chain);
  const code = accountCodeFromTallyName(name, codeSeqRef.value++);

  try {
    const acc = await db.account.create({
      data: {
        userId,
        code,
        name,
        type,
        parentId,
        isTallyGroup: true,
        tallyParentName: parentName,
        openingBalance: 0,
        isSystem: false,
      },
    });
    accountByTallyKey.set(name, acc.id);
    await upsertEntityMap(db, userId, jobId, "GROUP", name, "Account", acc.id, {
      parentTallyKey: parentName,
      meta: { autoCreated: true },
    });
    result.groupsImported++;
    log("INFO", `Auto-created missing group: ${name}`, { parent: parentName });
    return acc.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Group auto-create failed";
    result.errors.push(`${name}: ${msg}`);
    log("ERROR", `Failed to auto-create group ${name}`, msg);
    return null;
  }
}

async function upsertEntityMap(
  db: Db,
  userId: string,
  jobId: string,
  entityType: string,
  tallyKey: string,
  erpModel: string,
  erpId: string,
  extra?: { tallyGuid?: string | null; parentTallyKey?: string | null; meta?: unknown },
) {
  await db.tallyEntityMap.upsert({
    where: { userId_entityType_tallyKey: { userId, entityType, tallyKey } },
    create: {
      userId,
      jobId,
      entityType,
      tallyKey,
      tallyGuid: extra?.tallyGuid ?? null,
      erpModel,
      erpId,
      parentTallyKey: extra?.parentTallyKey ?? null,
      metaJson: extra?.meta ? JSON.stringify(extra.meta) : null,
    },
    update: {
      jobId,
      erpModel,
      erpId,
      tallyGuid: extra?.tallyGuid ?? null,
      parentTallyKey: extra?.parentTallyKey ?? null,
      metaJson: extra?.meta ? JSON.stringify(extra.meta) : null,
    },
  });
}

export async function importTallyCoa(
  userId: string,
  jobId: string,
  parsed: TallyParsedExport,
  log: LogFn,
  db: Db = prisma,
): Promise<CoaImportResult> {
  const result: CoaImportResult = {
    groupsImported: 0,
    groupsSkipped: 0,
    ledgersImported: 0,
    ledgersUpdated: 0,
    ledgersSkipped: 0,
    errors: [],
  };

  const groupMap = new Map<string, TallyParsedGroup>();
  for (const g of parsed.groups) groupMap.set(g.name, g);

  const accountByTallyKey = new Map<string, string>();
  const existingMaps = await db.tallyEntityMap.findMany({
    where: { userId, entityType: { in: ["GROUP", "LEDGER"] } },
  });
  for (const m of existingMaps) accountByTallyKey.set(m.tallyKey, m.erpId);

  let codeSeqRef = { value: 1 };

  const sortedGroups = [...parsed.groups].sort((a, b) => {
    const da = parentChain(groupMap, a.parent).length;
    const db_ = parentChain(groupMap, b.parent).length;
    return da - db_;
  });

  for (const group of sortedGroups) {
    if (!group.name || group.name.toLowerCase() === "primary") {
      result.groupsSkipped++;
      continue;
    }

    const existingId = accountByTallyKey.get(group.name);
    if (existingId) {
      const parentId = group.parent ? accountByTallyKey.get(group.parent) ?? null : null;
      try {
        await db.account.update({
          where: { id: existingId },
          data: {
            parentId,
            tallyGuid: group.guid,
            tallyParentName: group.parent,
            isTallyGroup: true,
            type: resolveAccountType(group.name, parentChain(groupMap, group.parent)),
          },
        });
        await upsertEntityMap(db, userId, jobId, "GROUP", group.name, "Account", existingId, {
          tallyGuid: group.guid,
          parentTallyKey: group.parent,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Group update failed";
        result.errors.push(`${group.name}: ${msg}`);
        log("WARN", `Failed to update group ${group.name}`, msg);
      }
      result.groupsSkipped++;
      continue;
    }

    if (group.parent) {
      await ensureGroupExists(
        db,
        userId,
        jobId,
        group.parent,
        groupMap.get(group.parent)?.parent ?? null,
        groupMap,
        accountByTallyKey,
        codeSeqRef,
        result,
        log,
      );
    }

    const parentId = group.parent ? accountByTallyKey.get(group.parent) : null;
    const chain = parentChain(groupMap, group.parent);
    const type = resolveAccountType(group.name, chain);
    const code = accountCodeFromTallyName(group.name, codeSeqRef.value++);

    try {
      const acc = await db.account.create({
        data: {
          userId,
          code,
          name: group.name,
          type,
          parentId,
          isTallyGroup: true,
          tallyGuid: group.guid,
          tallyParentName: group.parent,
          openingBalance: 0,
          isSystem: false,
        },
      });
      accountByTallyKey.set(group.name, acc.id);
      await upsertEntityMap(db, userId, jobId, "GROUP", group.name, "Account", acc.id, {
        tallyGuid: group.guid,
        parentTallyKey: group.parent,
      });
      result.groupsImported++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Group import failed";
      result.errors.push(`${group.name}: ${msg}`);
      log("ERROR", `Failed to import group ${group.name}`, msg);
    }
  }

  for (const ledger of parsed.ledgers) {
    if (ledger.parent) {
      await ensureGroupExists(
        db,
        userId,
        jobId,
        ledger.parent,
        groupMap.get(ledger.parent)?.parent ?? null,
        groupMap,
        accountByTallyKey,
        codeSeqRef,
        result,
        log,
      );
    }
    await importOneLedger(db, userId, jobId, ledger, groupMap, accountByTallyKey, codeSeqRef.value, result, log);
    codeSeqRef.value++;
  }

  return result;
}

async function importOneLedger(
  db: Db,
  userId: string,
  jobId: string,
  ledger: TallyParsedLedger,
  groupMap: Map<string, TallyParsedGroup>,
  accountByTallyKey: Map<string, string>,
  codeSeq: number,
  result: CoaImportResult,
  log: LogFn,
) {
  if (!ledger.name) {
    result.ledgersSkipped++;
    return;
  }

  const signedOb = ledger.isDebit ? ledger.openingBalance : -ledger.openingBalance;
  const parentId = ledger.parent ? accountByTallyKey.get(ledger.parent) : null;
  const chain = parentChain(groupMap, ledger.parent);
  const type = resolveAccountType(ledger.parent, chain);

  const existingId = accountByTallyKey.get(ledger.name);
  if (existingId) {
    try {
      await db.account.update({
        where: { id: existingId },
        data: {
          name: ledger.name,
          type,
          parentId: parentId ?? undefined,
          openingBalance: signedOb,
          tallyGuid: ledger.guid,
          tallyParentName: ledger.parent,
          isTallyGroup: false,
          description: ledger.alias ? `Alias: ${ledger.alias}` : undefined,
        },
      });
      await upsertEntityMap(db, userId, jobId, "LEDGER", ledger.name, "Account", existingId, {
        tallyGuid: ledger.guid,
        parentTallyKey: ledger.parent,
        meta: { gstin: ledger.gstin, pan: ledger.pan, address: ledger.address },
      });
      result.ledgersUpdated++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ledger update failed";
      result.errors.push(`${ledger.name}: ${msg}`);
      log("ERROR", `Failed to update ledger ${ledger.name}`, msg);
    }
    return;
  }

  const code = accountCodeFromTallyName(ledger.name, codeSeq);
  try {
    const acc = await db.account.create({
      data: {
        userId,
        code,
        name: ledger.name,
        type,
        parentId,
        openingBalance: signedOb,
        isTallyGroup: false,
        tallyGuid: ledger.guid,
        tallyParentName: ledger.parent,
        description: ledger.alias ? `Alias: ${ledger.alias}` : undefined,
        isSystem: false,
      },
    });
    accountByTallyKey.set(ledger.name, acc.id);
    await upsertEntityMap(db, userId, jobId, "LEDGER", ledger.name, "Account", acc.id, {
      tallyGuid: ledger.guid,
      parentTallyKey: ledger.parent,
      meta: { gstin: ledger.gstin, pan: ledger.pan, address: ledger.address },
    });
    result.ledgersImported++;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ledger import failed";
    result.errors.push(`${ledger.name}: ${msg}`);
    log("ERROR", `Failed to import ledger ${ledger.name}`, msg);
  }
}

export async function loadLedgerAccountMap(userId: string, db: Db = prisma): Promise<Map<string, string>> {
  const maps = await db.tallyEntityMap.findMany({ where: { userId, entityType: "LEDGER" } });
  const byKey = new Map(maps.map((m) => [normalizeTallyKey(m.tallyKey), m.erpId]));

  for (const m of maps) {
    const acc = await db.account.findFirst({ where: { id: m.erpId, userId }, select: { name: true } });
    if (acc?.name) byKey.set(normalizeTallyKey(acc.name), m.erpId);
  }
  return byKey;
}

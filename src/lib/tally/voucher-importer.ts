import { JournalPostingStatus, JournalReferenceKind, Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadLedgerAccountMap } from "@/lib/tally/coa-importer";
import { normalizeTallyKey } from "@/lib/tally/group-mapping";
import type { TallyParsedExport, TallyParsedVoucher } from "@/lib/tally/types";

type Db = PrismaClient | Prisma.TransactionClient;
type LogFn = (level: "INFO" | "WARN" | "ERROR", message: string, detail?: unknown) => void;

export type VoucherImportResult = {
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
};

const BATCH_SIZE = 100;

function voucherKey(v: TallyParsedVoucher): string {
  return `${v.voucherType}|${v.voucherNumber ?? ""}|${v.date}|${v.guid ?? v.narration ?? ""}`;
}

export async function importTallyVouchers(
  userId: string,
  jobId: string,
  parsed: TallyParsedExport,
  log: LogFn,
  db: Db = prisma,
): Promise<VoucherImportResult> {
  const result: VoucherImportResult = { imported: 0, skipped: 0, failed: 0, errors: [] };
  const ledgerMap = await loadLedgerAccountMap(userId, db);

  const existing = await db.tallyEntityMap.findMany({
    where: { userId, entityType: "VOUCHER" },
    select: { tallyKey: true },
  });
  const existingKeys = new Set(existing.map((e) => e.tallyKey));

  for (let i = 0; i < parsed.vouchers.length; i += BATCH_SIZE) {
    const batch = parsed.vouchers.slice(i, i + BATCH_SIZE);
    for (const v of batch) {
      const key = voucherKey(v);
      if (existingKeys.has(key)) {
        result.skipped++;
        continue;
      }

      const lines: { accountId: string; debit: number; credit: number; description?: string }[] = [];
      let missingLedger = false;

      for (const line of v.lines) {
        const accountId = ledgerMap.get(normalizeTallyKey(line.ledgerName));
        if (!accountId) {
          missingLedger = true;
          result.errors.push(`Voucher ${key}: missing ledger "${line.ledgerName}"`);
          log("WARN", `Missing ledger for voucher line: ${line.ledgerName}`, { voucher: key });
          break;
        }
        lines.push({
          accountId,
          debit: line.isDebit ? line.amount : 0,
          credit: line.isDebit ? 0 : line.amount,
          description: v.narration ?? undefined,
        });
      }

      if (missingLedger || lines.length === 0) {
        result.failed++;
        continue;
      }

      const totalDr = lines.reduce((s, l) => s + l.debit, 0);
      const totalCr = lines.reduce((s, l) => s + l.credit, 0);
      if (Math.abs(totalDr - totalCr) > 0.05) {
        result.failed++;
        result.errors.push(`Voucher ${key}: unbalanced Dr ${totalDr} Cr ${totalCr}`);
        log("ERROR", `Unbalanced voucher ${key}`, { totalDr, totalCr });
        continue;
      }

      try {
        const entryDate = new Date(`${v.date}T00:00:00.000Z`);
        const entry = await db.journalEntry.create({
          data: {
            userId,
            entryDate,
            memo: v.narration ?? `${v.voucherType} ${v.voucherNumber ?? ""}`.trim(),
            referenceKind: JournalReferenceKind.TALLY_IMPORT,
            referenceNo: v.voucherNumber,
            postingStatus: JournalPostingStatus.POSTED,
            tallyVoucherKey: key,
            tallyVoucherType: v.voucherType,
            tallyVoucherNumber: v.voucherNumber,
            lines: {
              create: lines.map((l) => ({
                accountId: l.accountId,
                debit: new Prisma.Decimal(l.debit),
                credit: new Prisma.Decimal(l.credit),
                description: l.description,
              })),
            },
          },
        });

        await db.tallyEntityMap.create({
          data: {
            userId,
            jobId,
            entityType: "VOUCHER",
            tallyKey: key,
            tallyGuid: v.guid,
            erpModel: "JournalEntry",
            erpId: entry.id,
            metaJson: JSON.stringify({ voucherType: v.voucherType, date: v.date }),
          },
        });
        existingKeys.add(key);
        result.imported++;
      } catch (e) {
        result.failed++;
        const msg = e instanceof Error ? e.message : "Voucher import failed";
        result.errors.push(`${key}: ${msg}`);
        log("ERROR", `Voucher import failed ${key}`, msg);
      }
    }
  }

  return result;
}

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { parseYmd } from "@/lib/dates";
import { bankingTxnFingerprint } from "@/lib/banking/fingerprint";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { bankingStatementImportSchema } from "@/lib/validators";

function parseTxnDate(s: string): Date {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return parseYmd(t.slice(0, 10));
  const ms = Date.parse(t);
  return Number.isNaN(ms) ? new Date(NaN) : new Date(ms);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bankingStatementImportSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const {
    bankingAccountId,
    fileName,
    fileHash,
    format,
    rows,
    duplicateMode,
    fileMime,
    fileSizeBytes,
  } = parsed.data;

  const acct = await prisma.bankingAccount.findFirst({
    where: { id: bankingAccountId, userId: session.sub },
  });
  if (!acct) return NextResponse.json({ error: "Bank account not found" }, { status: 404 });

  const dup = await prisma.bankStatementImport.findUnique({
    where: { bankingAccountId_fileHash: { bankingAccountId, fileHash } },
  });
  if (dup) {
    return NextResponse.json(
      { error: "This statement was already imported for this account.", code: "DUPLICATE_FILE" },
      { status: 409 },
    );
  }

  const similar = await prisma.bankStatementImport.findFirst({
    where: {
      bankingAccountId,
      userId: session.sub,
      fileName: fileName.trim(),
      fileHash: { not: fileHash.trim() },
    },
    orderBy: { importedAt: "desc" },
  });

  let duplicateHint: string | null = null;
  if (similar && Math.abs(similar.rowCount - rows.length) <= 3) {
    duplicateHint = "Possible duplicate statement detected (same file name and similar row count as a recent import).";
  }

  const prepared = rows.map((r) => {
    const txnDate = parseTxnDate(r.txnDate);
    const fp = bankingTxnFingerprint(bankingAccountId, {
      txnDate: Number.isNaN(txnDate.getTime()) ? new Date(0) : txnDate,
      description: r.description,
      debit: r.debit,
      credit: r.credit,
      reference: r.reference,
    });
    return { ...r, txnDate, fp };
  });

  const validPrepared = prepared.filter((p) => !Number.isNaN(p.txnDate.getTime()));

  const fingerprints = validPrepared.map((p) => p.fp);
  const fpInBatch = new Map<string, number>();
  for (const f of fingerprints) fpInBatch.set(f, (fpInBatch.get(f) ?? 0) + 1);
  if (duplicateMode === "reject" && [...fpInBatch.values()].some((c) => c > 1)) {
    return NextResponse.json({ error: "Duplicate rows in this import." }, { status: 400 });
  }

  const existing = await prisma.bankingTransaction.findMany({
    where: {
      bankingAccountId,
      userId: session.sub,
      sourceFingerprint: { in: fingerprints },
    },
    select: { sourceFingerprint: true },
  });
  const existingFp = new Set(existing.map((e) => e.sourceFingerprint).filter(Boolean) as string[]);

  if (duplicateMode === "reject" && existingFp.size > 0) {
    const hits = fingerprints.filter((f) => existingFp.has(f));
    if (hits.length) {
      return NextResponse.json(
        { error: "One or more rows match existing transactions (duplicateMode: reject).", duplicateFingerprints: hits.length },
        { status: 409 },
      );
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const imp = await tx.bankStatementImport.create({
        data: {
          userId: session.sub,
          bankingAccountId,
          fileName: fileName.trim(),
          fileHash: fileHash.trim(),
          format,
          rowCount: 0,
          fileMime: fileMime?.trim() || null,
          fileSizeBytes: fileSizeBytes ?? null,
          duplicateHint,
        },
      });

      let imported = 0;
      let skippedDuplicates = 0;
      const seenInBatch = new Set<string>();
      const createdIds: string[] = [];

      for (const p of validPrepared) {
        if (duplicateMode === "skip") {
          if (existingFp.has(p.fp) || seenInBatch.has(p.fp)) {
            skippedDuplicates++;
            continue;
          }
        }
        seenInBatch.add(p.fp);

        const txn = await tx.bankingTransaction.create({
          data: {
            userId: session.sub,
            bankingAccountId,
            statementImportId: imp.id,
            txnDate: p.txnDate,
            description: p.description,
            reference: p.reference?.trim() || null,
            debit: new Prisma.Decimal(p.debit),
            credit: new Prisma.Decimal(p.credit),
            balance: p.balance != null ? new Prisma.Decimal(p.balance) : null,
            status: "UNMAPPED",
            sourceFingerprint: p.fp,
          },
        });
        createdIds.push(txn.id);
        imported++;
      }

      await tx.bankStatementImport.update({
        where: { id: imp.id },
        data: { rowCount: imported },
      });

      await tx.bankingAccount.update({
        where: { id: bankingAccountId },
        data: { lastSyncedAt: new Date() },
      });

      return { importId: imp.id, imported, skippedDuplicates, createdIds };
    });

    return NextResponse.json(
      {
        importId: result.importId,
        imported: result.imported,
        skippedDuplicates: result.skippedDuplicates,
        duplicateHint,
        status: "Imported",
        reconciliation: "Pending",
        transactionIds: result.createdIds.slice(0, 25),
      },
      { status: 201 },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}

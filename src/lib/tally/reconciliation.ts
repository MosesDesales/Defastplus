import { prisma } from "@/lib/prisma";
import type { ReconcileRow, TallyParsedExport } from "@/lib/tally/types";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

type BalanceSide = { debit: number; credit: number };

function signedToDrCr(signed: number): BalanceSide {
  if (signed >= 0) return { debit: round2(signed), credit: 0 };
  return { debit: 0, credit: round2(Math.abs(signed)) };
}

/** Build Tally-side balances from opening balances and optional voucher movements. */
export function computeTallyBalances(
  parsed: TallyParsedExport,
  includeVoucherMovements: boolean,
): Map<string, BalanceSide> {
  const signed = new Map<string, number>();

  for (const l of parsed.ledgers) {
    const ob = l.isDebit ? l.openingBalance : -l.openingBalance;
    signed.set(l.name, (signed.get(l.name) ?? 0) + ob);
  }

  if (includeVoucherMovements) {
    for (const v of parsed.vouchers) {
      for (const line of v.lines) {
        const delta = line.isDebit ? line.amount : -line.amount;
        signed.set(line.ledgerName, (signed.get(line.ledgerName) ?? 0) + delta);
      }
    }
  }

  const out = new Map<string, BalanceSide>();
  for (const [name, value] of signed) {
    out.set(name, signedToDrCr(value));
  }
  return out;
}

export type ReconcileOptions = {
  /** When true, compare closing balances (OB + vouchers). When false, opening balances only. */
  includeVoucherMovements?: boolean;
};

/** Compare Tally balances vs ERP account opening balances + posted journals. */
export async function reconcileTrialBalance(
  userId: string,
  parsed: TallyParsedExport,
  options: ReconcileOptions = {},
): Promise<{
  rows: ReconcileRow[];
  tallyTotalDr: number;
  tallyTotalCr: number;
  erpTotalDr: number;
  erpTotalCr: number;
  balanced: boolean;
  mode: "opening" | "closing";
}> {
  const includeVoucherMovements = options.includeVoucherMovements ?? parsed.vouchers.length > 0;
  const mode = includeVoucherMovements ? "closing" : "opening";

  const maps = await prisma.tallyEntityMap.findMany({
    where: { userId, entityType: "LEDGER" },
  });

  const accountIds = maps.map((m) => m.erpId);
  const accounts = await prisma.account.findMany({
    where: { userId, id: { in: accountIds } },
    select: { id: true, name: true, openingBalance: true },
  });
  const accById = new Map(accounts.map((a) => [a.id, a]));

  const journalSums = includeVoucherMovements
    ? await prisma.journalLine.groupBy({
        by: ["accountId"],
        where: { journalEntry: { userId, postingStatus: "POSTED" } },
        _sum: { debit: true, credit: true },
      })
    : [];
  const jByAcc = new Map(journalSums.map((j) => [j.accountId, j]));

  const tallyByName = computeTallyBalances(parsed, includeVoucherMovements);
  const allNames = new Set<string>([...tallyByName.keys(), ...maps.map((m) => m.tallyKey)]);

  const rows: ReconcileRow[] = [];

  for (const name of allNames) {
    const tally = tallyByName.get(name) ?? { debit: 0, credit: 0 };
    const map = maps.find((m) => m.tallyKey === name);
    let erpDebit = 0;
    let erpCredit = 0;

    if (map) {
      const acc = accById.get(map.erpId);
      const ob = Number(acc?.openingBalance ?? 0);
      if (ob >= 0) erpDebit += ob;
      else erpCredit += Math.abs(ob);

      if (includeVoucherMovements) {
        const js = jByAcc.get(map.erpId);
        erpDebit += Number(js?._sum.debit ?? 0);
        erpCredit += Number(js?._sum.credit ?? 0);
      }
    }

    erpDebit = round2(erpDebit);
    erpCredit = round2(erpCredit);
    const tallyDebit = round2(tally.debit);
    const tallyCredit = round2(tally.credit);

    rows.push({
      ledgerName: name,
      tallyDebit,
      tallyCredit,
      erpDebit,
      erpCredit,
      debitDiff: round2(erpDebit - tallyDebit),
      creditDiff: round2(erpCredit - tallyCredit),
    });
  }

  rows.sort(
    (a, b) =>
      Math.abs(b.debitDiff) + Math.abs(b.creditDiff) - (Math.abs(a.debitDiff) + Math.abs(a.creditDiff)),
  );

  const tallyTotalDr = round2(rows.reduce((s, r) => s + r.tallyDebit, 0));
  const tallyTotalCr = round2(rows.reduce((s, r) => s + r.tallyCredit, 0));
  const erpTotalDr = round2(rows.reduce((s, r) => s + r.erpDebit, 0));
  const erpTotalCr = round2(rows.reduce((s, r) => s + r.erpCredit, 0));
  const balanced =
    Math.abs(tallyTotalDr - tallyTotalCr) < 0.05 &&
    Math.abs(erpTotalDr - erpTotalCr) < 0.05 &&
    rows.every((r) => Math.abs(r.debitDiff) < 0.05 && Math.abs(r.creditDiff) < 0.05);

  return { rows, tallyTotalDr, tallyTotalCr, erpTotalDr, erpTotalCr, balanced, mode };
}

export function reconcileSummary(rows: ReconcileRow[]) {
  const mismatches = rows.filter((r) => Math.abs(r.debitDiff) >= 0.05 || Math.abs(r.creditDiff) >= 0.05);
  return {
    totalLedgers: rows.length,
    mismatches: mismatches.length,
    topMismatches: mismatches.slice(0, 25),
  };
}

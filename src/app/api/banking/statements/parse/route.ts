import { NextResponse } from "next/server";
import { detectBankFormat } from "@/lib/banking/bank-format-detect";
import {
  parseBankStatementCsv,
  parseBankStatementCsvWithColumnMap,
  parseBankTableWithColumnMap,
  type ParsedBankRow,
} from "@/lib/banking/parse-csv";
import { parseTransactionsFromPlainText, validateRunningBalances } from "@/lib/banking/parse-bank-text";
import { getSession } from "@/lib/session";
import { bankingStatementParseSchema } from "@/lib/validators";

export const runtime = "nodejs";

function serializeRows(rows: ParsedBankRow[]) {
  return rows.map((r) => ({
    txnDate: r.txnDate.toISOString(),
    description: r.description,
    debit: r.debit,
    credit: r.credit,
    balance: r.balance,
    reference: r.reference,
  }));
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

  const parsed = bankingStatementParseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  let rows: ParsedBankRow[] = [];
  let detectedBank: string = "UNKNOWN";

  if (d.csvText) {
    rows = d.columnMap
      ? parseBankStatementCsvWithColumnMap(d.csvText, d.columnMap)
      : parseBankStatementCsv(d.csvText);
    detectedBank = detectBankFormat(d.csvText.slice(0, 8000));
  } else if (d.rawText) {
    const hint = d.bankHint?.trim() || detectBankFormat(d.rawText.slice(0, 12000));
    detectedBank = hint;
    const plain = parseTransactionsFromPlainText(d.rawText, hint);
    rows = plain.rows;
    const parseWarnings = [...plain.warnings];
    if (!rows.length) {
      rows = parseBankStatementCsv(d.rawText);
    }
    const balanceWarnings = validateRunningBalances(rows, null);
    return NextResponse.json({
      rows: serializeRows(rows),
      detectedBank,
      warnings: [...parseWarnings, ...balanceWarnings],
    });
  } else if (d.table && d.headerRowIndex != null && d.columnMap) {
    rows = parseBankTableWithColumnMap(d.table, d.headerRowIndex, d.columnMap);
    detectedBank = detectBankFormat(d.table.slice(0, 20).flat().join("\n"));
  }

  const balanceWarnings = validateRunningBalances(rows, null);

  return NextResponse.json({
    rows: serializeRows(rows),
    detectedBank,
    warnings: balanceWarnings,
  });
}

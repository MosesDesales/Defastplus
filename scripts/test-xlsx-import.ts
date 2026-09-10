import "dotenv/config";
import { readFileSync } from "fs";
import { extractBankStatementFromBuffer } from "../src/lib/banking/extract-from-file";
import { parseBankTableWithColumnMap, type CsvColumnMap } from "../src/lib/banking/parse-csv";

// Mirrors StatementUploadWizard.tsx's client-side guessColumnMap()
function guessColumnMap(headers: (string | undefined)[]): CsvColumnMap {
  const H = headers.map((h) => (h ?? "").trim().toLowerCase());
  const findIdx = (test: (s: string) => boolean): number | null => {
    const i = H.findIndex(test);
    return i >= 0 ? i : null;
  };
  const date = findIdx((s) => /date|value\s*dt|txn|transaction|posting/i.test(s)) ?? findIdx((s) => s === "date") ?? 0;
  const description = findIdx((s) => /narrat|particular|description|details|remarks/i.test(s)) ?? Math.min(1, Math.max(0, H.length - 1));
  const debit = findIdx((s) => /debit|withdraw|dr\.?|paid out/i.test(s));
  const credit = findIdx((s) => /credit|deposit|cr\.?|paid in/i.test(s));
  const balance = findIdx((s) => /balance|closing/i.test(s));
  const reference = findIdx((s) => /ref|chq|cheque|utr|transaction id/i.test(s));
  return { date, description, debit: debit ?? undefined, credit: credit ?? undefined, balance: balance ?? undefined, reference: reference ?? undefined };
}

function suggestHeaderRow(matrix: string[][]): number {
  for (let i = 0; i < Math.min(matrix.length, 25); i++) {
    const joined = (matrix[i] ?? []).join(" ").toLowerCase();
    if (/date|value|txn|narrat|debit|credit|balance|particular/i.test(joined)) return i;
  }
  return 0;
}

async function main() {
  const buf = readFileSync("/tmp/test-statement.xlsx");
  const result = await extractBankStatementFromBuffer(buf, "test-statement.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

  console.log("kind:", result.kind);
  console.log("sheetNames:", result.sheetNames);
  console.log("warnings:", result.warnings);
  console.log("tablePreview:");
  console.table(result.tablePreview);

  const tableSample = result.tableSample!;
  const headerRowIndex = suggestHeaderRow(tableSample);
  console.log("guessed headerRowIndex:", headerRowIndex);
  const columnMap = guessColumnMap(tableSample[headerRowIndex]!);
  console.log("guessed columnMap:", columnMap);

  const rows = parseBankTableWithColumnMap(tableSample, headerRowIndex, columnMap);
  console.log(`parsed ${rows.length} rows:`);
  for (const r of rows) {
    console.log(
      r.txnDate.toISOString().slice(0, 10),
      "|",
      r.description,
      "| debit:",
      r.debit,
      "| credit:",
      r.credit,
      "| balance:",
      r.balance,
      "| ref:",
      r.reference,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

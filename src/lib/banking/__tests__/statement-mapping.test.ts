import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  columnLetter,
  columnOptions,
  guessMapping,
  headingSignature,
  mappingErrors,
  parseStatementDate,
  parseWithMapping,
  readAmount,
  suggestHeaderRow,
} from "@/lib/banking/statement-mapping";

const ymd = (d: Date | null) =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : null;

// HDFC-style export: title rows above the real header, separate Withdrawal/Deposit columns.
const HDFC = [
  ["HDFC BANK Ltd.", "", "", "", "", "", ""],
  ["Statement of account", "", "", "", "", "", ""],
  ["", "", "", "", "", "", ""],
  ["Date", "Narration", "Chq./Ref.No.", "Value Dt", "Withdrawal Amt.", "Deposit Amt.", "Closing Balance"],
  ["01/04/26", "Opening Balance", "", "", "", "", "10,000.00"],
  ["02/04/26", "UPI-RAMESH-OKAXIS", "0000412345", "02/04/26", "1,250.00", "", "8,750.00"],
  ["15/04/26", "NEFT CR-ACME TRADERS", "N1234", "15/04/26", "", "25,000.00", "33,750.00"],
  ["", "", "", "", "", "", ""],
];

describe("statement mapping", () => {
  it("finds the header row below bank title rows", () => {
    assert.equal(suggestHeaderRow(HDFC), 3);
  });

  it("guesses columns from headings", () => {
    const m = guessMapping(HDFC);
    assert.equal(m.headerRowIndex, 3);
    assert.equal(m.date, 0);
    assert.equal(m.description, 1);
    assert.equal(m.reference, 2);
    assert.equal(m.amountLayout, "split");
    assert.equal(m.debit, 4);
    assert.equal(m.credit, 5);
    assert.equal(m.balance, 6);
    assert.deepEqual(mappingErrors(m), []);
  });

  it("parses rows, skipping opening balance lines with a reason", () => {
    const { rows, skipped } = parseWithMapping(HDFC, guessMapping(HDFC));
    assert.equal(rows.length, 2);
    assert.deepEqual([ymd(rows[0]!.txnDate), rows[0]!.debit, rows[0]!.credit, rows[0]!.balance], ["2026-04-02", 1250, 0, 8750]);
    assert.deepEqual([ymd(rows[1]!.txnDate), rows[1]!.credit, rows[1]!.reference], ["2026-04-15", 25000, "N1234"]);
    assert.equal(skipped.length, 1);
    assert.match(skipped[0]!.reason, /opening/i);
    assert.equal(skipped[0]!.row, 5);
  });

  it("supports a single Amount column with a Dr/Cr column", () => {
    const t = [
      ["Txn Date", "Description", "Amount", "Dr/Cr", "Balance"],
      ["05-Apr-2026", "ATM WDL", "2,000.00", "DR", "8,000.00"],
      ["06-Apr-2026", "Salary", "50,000.00", "CR", "58,000.00"],
    ];
    const m = guessMapping(t);
    assert.equal(m.amountLayout, "single_drcr");
    const { rows } = parseWithMapping(t, m);
    assert.deepEqual(rows.map((r) => [r.debit, r.credit]), [[2000, 0], [0, 50000]]);
  });

  it("supports a signed single Amount column and Dr/Cr suffixes", () => {
    const t = [
      ["Date", "Details", "Amount"],
      ["2026-04-01", "Card", "-499.00"],
      ["2026-04-02", "Refund", "499.00"],
      ["2026-04-03", "Fee", "18.00 Dr"],
    ];
    const m = guessMapping(t);
    assert.equal(m.amountLayout, "single");
    const { rows } = parseWithMapping(t, m);
    assert.deepEqual(rows.map((r) => [r.debit, r.credit]), [[499, 0], [0, 499], [18, 0]]);
    const flipped = parseWithMapping(t, { ...m, negativeIs: "credit" }).rows;
    assert.deepEqual(flipped.map((r) => [r.debit, r.credit]).slice(0, 2), [[0, 499], [499, 0]]);
  });

  it("reports what is missing from a mapping", () => {
    const m = { ...guessMapping(HDFC), date: null, debit: null, credit: null };
    assert.deepEqual(mappingErrors(m), ["Choose the Date column.", "Choose the Debit and/or Credit column."]);
    assert.deepEqual(parseWithMapping(HDFC, m).rows, []);
  });

  it("lists columns with headings, letters and sample values", () => {
    const opts = columnOptions(HDFC, 3);
    assert.deepEqual(opts[4], { index: 4, letter: "E", heading: "Withdrawal Amt.", sample: "1,250.00" });
    assert.equal(columnLetter(27), "AB");
    assert.equal(headingSignature(HDFC, 3), "date|narration|chq./ref.no.|value dt|withdrawal amt.|deposit amt.|closing balance");
  });
});

describe("statement dates", () => {
  it("reads Indian DD/MM by default and honours the chosen format", () => {
    assert.equal(ymd(parseStatementDate("03/04/2026")), "2026-04-03");
    assert.equal(ymd(parseStatementDate("03/04/2026", "MDY")), "2026-03-04");
    assert.equal(ymd(parseStatementDate("2026/04/03", "YMD")), "2026-04-03");
    assert.equal(ymd(parseStatementDate("04/25/2026")), "2026-04-25"); // unambiguous month-first
  });

  it("reads month names, ISO, two-digit years and Excel serial numbers", () => {
    assert.equal(ymd(parseStatementDate("09 Feb 2026")), "2026-02-09");
    assert.equal(ymd(parseStatementDate("Feb 9, 2026")), "2026-02-09");
    assert.equal(ymd(parseStatementDate("2026-02-09T00:00:00Z")), "2026-02-09");
    assert.equal(ymd(parseStatementDate("02/04/26")), "2026-04-02");
    assert.equal(ymd(parseStatementDate("46023")), "2026-01-01");
  });

  it("rejects impossible dates and text", () => {
    assert.equal(parseStatementDate("31/02/2026"), null);
    assert.equal(parseStatementDate("Opening Balance"), null);
  });
});

describe("readAmount", () => {
  it("handles commas, currency and Dr/Cr markers", () => {
    assert.deepEqual(readAmount("₹1,23,456.78"), { value: 123456.78, marker: null });
    assert.deepEqual(readAmount("1,250.00 Dr"), { value: 1250, marker: "debit" });
    assert.deepEqual(readAmount("CR 500"), { value: 500, marker: "credit" });
    assert.deepEqual(readAmount("(300.00)"), { value: -300, marker: null });
  });
});

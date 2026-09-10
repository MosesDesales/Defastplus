import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveAccountType } from "@/lib/tally/group-mapping";
import { computeTallyBalances } from "@/lib/tally/reconciliation";
import { parseTallyXml } from "@/lib/tally/xml-parser";

const __dir = dirname(fileURLToPath(import.meta.url));
const sampleXml = readFileSync(join(__dir, "fixtures", "sample-export.xml"), "utf8");

describe("Tally XML parser", () => {
  it("parses groups and ledgers", () => {
    const p = parseTallyXml(sampleXml);
    assert.equal(p.groups.length, 3);
    assert.equal(p.ledgers.length, 2);
    assert.equal(p.ledgers[0]?.name, "Acme Customer");
    assert.equal(p.ledgers[0]?.openingBalance, 5000);
  });

  it("parses journal voucher lines", () => {
    const p = parseTallyXml(sampleXml);
    assert.equal(p.vouchers.length, 1);
    assert.equal(p.vouchers[0]?.lines.length, 2);
    assert.equal(p.vouchers[0]?.voucherNumber, "JV-1");
  });

  it("maps sundry debtors to ASSET", () => {
    assert.equal(resolveAccountType("Sundry Debtors", ["Current Assets"]), "ASSET");
  });

  it("builds trial balance from opening balances", () => {
    const p = parseTallyXml(sampleXml);
    const acme = p.trialBalanceFromTally.find((r) => r.ledgerName === "Acme Customer");
    assert.equal(acme?.debit, 5000);
    assert.equal(acme?.credit, 0);
  });

  it("computes closing balances from vouchers", () => {
    const p = parseTallyXml(sampleXml);
    const opening = computeTallyBalances(p, false);
    const closing = computeTallyBalances(p, true);
    assert.equal(opening.get("Acme Customer")?.debit, 5000);
    assert.notEqual(closing.get("Acme Customer")?.debit, opening.get("Acme Customer")?.debit);
  });
});

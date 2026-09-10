import type {
  TallyParsedCompany,
  TallyParsedExport,
  TallyParsedGroup,
  TallyParsedLedger,
  TallyParsedStockItem,
  TallyParsedVoucher,
  TallyParsedVoucherLine,
} from "@/lib/tally/types";
import { normalizeTallyKey } from "@/lib/tally/group-mapping";

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function getAttr(openTag: string, attr: string): string | null {
  const re = new RegExp(`\\b${attr}\\s*=\\s*"([^"]*)"`, "i");
  const m = openTag.match(re);
  return m?.[1] != null ? decodeXmlEntities(m[1]) : null;
}

function getTagValue(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = block.match(re);
  if (!m?.[1]) return null;
  return decodeXmlEntities(m[1].trim());
}

function extractBlocks(xml: string, tag: string): string[] {
  const blocks: string[] = [];
  const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    blocks.push(m[0]!);
  }
  return blocks;
}

function extractListBlocks(block: string, listTag: string): string[] {
  return extractBlocks(block, listTag.replace(/\./g, "\\."));
}

function parseTallyAmount(raw: string | null, isDeemedPositive: boolean): { amount: number; isDebit: boolean } {
  const n = Math.abs(Number(String(raw ?? "0").replace(/,/g, "")) || 0);
  return { amount: n, isDebit: isDeemedPositive };
}

function parseYmdFromTally(raw: string | null): string {
  if (!raw?.trim()) return new Date().toISOString().slice(0, 10);
  const s = raw.trim();
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function parseGroupBlock(block: string): TallyParsedGroup | null {
  const open = block.match(/^<GROUP\b[^>]*>/i)?.[0] ?? "";
  const name = getAttr(open, "NAME") ?? getTagValue(block, "NAME");
  if (!name?.trim()) return null;
  return {
    name: normalizeTallyKey(name),
    parent: normalizeTallyKey(getTagValue(block, "PARENT") ?? getAttr(open, "PARENT") ?? "") || null,
    guid: getTagValue(block, "GUID") ?? getAttr(open, "GUID"),
    reservedName: getTagValue(block, "RESERVEDNAME"),
  };
}

function parseLedgerBlock(block: string): TallyParsedLedger | null {
  const open = block.match(/^<LEDGER\b[^>]*>/i)?.[0] ?? "";
  const name = getAttr(open, "NAME") ?? getTagValue(block, "NAME");
  if (!name?.trim()) return null;
  const deemed = (getTagValue(block, "ISDEEMEDPOSITIVE") ?? "").toLowerCase().startsWith("y");
  const obRaw = getTagValue(block, "OPENINGBALANCE");
  const { amount, isDebit } = parseTallyAmount(obRaw, deemed);
  const addr = [
    getTagValue(block, "ADDRESS.LIST"),
    getTagValue(block, "LEDSTATENAME"),
    getTagValue(block, "PINCODE"),
  ]
    .filter(Boolean)
    .join(", ");

  return {
    name: normalizeTallyKey(name),
    parent: normalizeTallyKey(getTagValue(block, "PARENT") ?? "") || null,
    guid: getTagValue(block, "GUID") ?? getAttr(open, "GUID"),
    alias: getTagValue(block, "ALIAS"),
    openingBalance: amount,
    isDebit,
    gstin: getTagValue(block, "PARTYGSTIN") ?? getTagValue(block, "GSTIN"),
    pan: getTagValue(block, "INCOMETAXNUMBER"),
    address: addr || null,
  };
}

function parseVoucherBlock(block: string): TallyParsedVoucher | null {
  const open = block.match(/^<VOUCHER\b[^>]*>/i)?.[0] ?? "";
  const voucherType = getAttr(open, "VCHTYPE") ?? getTagValue(block, "VOUCHERTYPENAME") ?? "Journal";
  const lines: TallyParsedVoucherLine[] = [];

  for (const lb of extractListBlocks(block, "ALLLEDGERENTRIES.LIST")) {
    const ledgerName = getTagValue(lb, "LEDGERNAME");
    if (!ledgerName?.trim()) continue;
    const deemed = (getTagValue(lb, "ISDEEMEDPOSITIVE") ?? "").toLowerCase().startsWith("y");
    const { amount, isDebit } = parseTallyAmount(getTagValue(lb, "AMOUNT"), deemed);
    if (amount === 0) continue;
    lines.push({ ledgerName: normalizeTallyKey(ledgerName), amount, isDebit });
  }

  for (const lb of extractListBlocks(block, "LEDGERENTRIES.LIST")) {
    const ledgerName = getTagValue(lb, "LEDGERNAME");
    if (!ledgerName?.trim()) continue;
    const deemed = (getTagValue(lb, "ISDEEMEDPOSITIVE") ?? "").toLowerCase().startsWith("y");
    const { amount, isDebit } = parseTallyAmount(getTagValue(lb, "AMOUNT"), deemed);
    if (amount === 0) continue;
    lines.push({ ledgerName: normalizeTallyKey(ledgerName), amount, isDebit });
  }

  if (lines.length === 0) return null;

  return {
    voucherType,
    voucherNumber: getTagValue(block, "VOUCHERNUMBER"),
    date: parseYmdFromTally(getTagValue(block, "DATE") ?? getTagValue(block, "EFFECTIVEDATE")),
    guid: getTagValue(block, "GUID") ?? getAttr(open, "GUID"),
    narration: getTagValue(block, "NARRATION"),
    lines,
  };
}

function parseStockItemBlock(block: string): TallyParsedStockItem | null {
  const open = block.match(/^<STOCKITEM\b[^>]*>/i)?.[0] ?? "";
  const name = getAttr(open, "NAME") ?? getTagValue(block, "NAME");
  if (!name?.trim()) return null;
  return {
    name: normalizeTallyKey(name),
    parent: normalizeTallyKey(getTagValue(block, "PARENT") ?? "") || null,
    guid: getTagValue(block, "GUID") ?? getAttr(open, "GUID"),
    unit: getTagValue(block, "BASEUNITS"),
    openingQty: Number(getTagValue(block, "OPENINGBALANCE") ?? 0) || 0,
    openingValue: Number(getTagValue(block, "OPENINGVALUE") ?? 0) || 0,
    hsnCode: getTagValue(block, "HSNCODE") ?? getTagValue(block, "HSN"),
    gstRate: Number(getTagValue(block, "GSTRATE") ?? 0) || null,
  };
}

function parseCompany(xml: string): TallyParsedCompany {
  const companyBlock = extractBlocks(xml, "COMPANY")[0] ?? xml.slice(0, 5000);
  return {
    name: getTagValue(companyBlock, "NAME"),
    gstin: getTagValue(companyBlock, "GSTIN"),
    financialYearFrom: getTagValue(companyBlock, "STARTINGFROM"),
  };
}

function buildTrialBalance(ledgers: TallyParsedLedger[]): TallyParsedExport["trialBalanceFromTally"] {
  return ledgers.map((l) => ({
    ledgerName: l.name,
    debit: l.isDebit ? l.openingBalance : 0,
    credit: l.isDebit ? 0 : l.openingBalance,
  }));
}

/** Parse Tally XML export (full company backup or collection export). */
export function parseTallyXml(xml: string): TallyParsedExport {
  const normalized = xml.replace(/^\uFEFF/, "").trim();
  const groups = extractBlocks(normalized, "GROUP")
    .map(parseGroupBlock)
    .filter((g): g is TallyParsedGroup => g != null);
  const ledgers = extractBlocks(normalized, "LEDGER")
    .map(parseLedgerBlock)
    .filter((l): l is TallyParsedLedger => l != null);
  const vouchers = extractBlocks(normalized, "VOUCHER")
    .map(parseVoucherBlock)
    .filter((v): v is TallyParsedVoucher => v != null);
  const stockItems = extractBlocks(normalized, "STOCKITEM")
    .map(parseStockItemBlock)
    .filter((s): s is TallyParsedStockItem => s != null);

  return {
    company: parseCompany(normalized),
    groups,
    ledgers,
    vouchers,
    stockItems,
    trialBalanceFromTally: buildTrialBalance(ledgers),
  };
}

export function summarizeParsedExport(parsed: TallyParsedExport) {
  return {
    company: parsed.company,
    counts: {
      groups: parsed.groups.length,
      ledgers: parsed.ledgers.length,
      vouchers: parsed.vouchers.length,
      stockItems: parsed.stockItems.length,
    },
    trialBalanceFromTally: parsed.trialBalanceFromTally,
  };
}

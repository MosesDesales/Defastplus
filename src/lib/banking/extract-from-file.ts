import * as XLSX from "xlsx";

import { detectBankFormat } from "@/lib/banking/bank-format-detect";
import {
  detectCsvDelim,
  parseBankStatementCsv,
  type ParsedBankRow,
  splitCsvLine,
} from "@/lib/banking/parse-csv";
import { parseTransactionsFromPlainText, validateRunningBalances } from "@/lib/banking/parse-bank-text";
import { extractRawTextFromDocument } from "@/lib/ocr/extract-text";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PARSE_ROWS = 5000;
/** Rows sent to the mapping step (must stay within the parse API's table limit). */
const MAX_TABLE_ROWS = 5000;

export type BankStatementFileKind = "csv" | "xlsx" | "xls" | "pdf" | "image";

export type BankStatementExtractResult = {
  kind: BankStatementFileKind;
  mime: string;
  fileName: string;
  fileSizeBytes: number;
  suggestedBank: ReturnType<typeof detectBankFormat>;
  warnings: string[];
  ocrConfidence: number | null;
  ocrEngine: string | null;
  rawTextPreview: string | null;
  /** First rows of Excel / CSV matrix for sheet preview (max 10). */
  tablePreview: string[][] | null;
  /** Up to 200 rows for client-side column mapping (Excel / wide CSV). */
  tableSample: string[][] | null;
  sheetNames: string[] | null;
  /** Heuristic parse — CSV from `parseBankStatementCsv`; text from `parseTransactionsFromPlainText`. */
  autoParsed: ParsedBankRow[];
  /** Full CSV when under size cap (client re-parse with column map). */
  csvFullText: string | null;
};

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function guessKind(ext: string, mime: string): BankStatementFileKind | null {
  const m = mime.toLowerCase().split(";")[0]?.trim() ?? "";
  if (ext === "csv" || m === "text/csv") return "csv";
  if (ext === "xlsx" || m.includes("spreadsheetml")) return "xlsx";
  if (ext === "xls" || m === "application/vnd.ms-excel") return "xls";
  if (ext === "pdf" || m === "application/pdf") return "pdf";
  if (["jpg", "jpeg", "png", "webp"].includes(ext) || m.startsWith("image/")) return "image";
  return null;
}

function sheetToMatrix(sheet: XLSX.WorkSheet, maxRows: number): string[][] {
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");
  const out: string[][] = [];
  for (let r = range.s.r; r <= range.e.r && out.length < maxRows; r++) {
    const row: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      // A genuine Excel date cell must be read via its Date value (ISO, unambiguous), not its
      // locale-formatted display text (`cell.w`) — e.g. "4/15/26" is ambiguous DD/MM vs MM/DD
      // and gets misread by the flexible date parser downstream.
      const v =
        cell?.v instanceof Date ? cell.v.toISOString().slice(0, 10) : (cell?.w ?? (cell?.v != null ? String(cell.v) : ""));
      row.push(v);
    }
    out.push(row);
  }
  return out;
}

function suggestHeaderRow(matrix: string[][]): number {
  for (let i = 0; i < Math.min(matrix.length, 30); i++) {
    const joined = matrix[i]!.join(" ").toLowerCase();
    if (
      /date|value\s*dt|txn|transaction|posting|narration|particulars|description|debit|credit|withdraw|deposit|balance|ref/i.test(
        joined,
      )
    ) {
      return i;
    }
  }
  return 0;
}

function trimParsed(rows: ParsedBankRow[]): ParsedBankRow[] {
  if (rows.length <= MAX_PARSE_ROWS) return rows;
  return rows.slice(0, MAX_PARSE_ROWS);
}

export async function extractBankStatementFromBuffer(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  opts?: { sheetIndex?: number },
): Promise<BankStatementExtractResult> {
  const warnings: string[] = [];
  if (buffer.length > MAX_BYTES) {
    throw new Error("File exceeds 10MB limit.");
  }

  const ext = extOf(fileName);
  const kind = guessKind(ext, mimeType);
  if (!kind) {
    throw new Error("Unsupported file type. Use CSV, XLSX, XLS, PDF, JPG, or PNG.");
  }

  const base: Omit<BankStatementExtractResult, "autoParsed"> = {
    kind,
    mime: mimeType,
    fileName,
    fileSizeBytes: buffer.length,
    suggestedBank: "UNKNOWN",
    warnings,
    ocrConfidence: null,
    ocrEngine: null,
    rawTextPreview: null,
    tablePreview: null,
    tableSample: null,
    sheetNames: null,
    csvFullText: null,
  };

  if (kind === "csv") {
    let text = buffer.toString("utf8");
    if (text.includes("\u0000")) {
      warnings.push("Binary content detected in CSV; UTF-8 decode may be imperfect.");
    }
    if (text.length > 6_000_000) {
      warnings.push("Very large CSV; only the first portion was parsed.");
      text = text.slice(0, 6_000_000);
    }
    const lines = text.split(/\r?\n/).filter(Boolean);
    const delim = lines[0] ? detectCsvDelim(lines[0]) : ",";
    const previewRows = lines.slice(0, 11).map((ln) => splitCsvLine(ln, delim));
    // Full table (capped) so the column-mapping step covers every row, same as Excel.
    const sampleLines = lines.slice(0, MAX_TABLE_ROWS);
    const tableSample = sampleLines.map((ln) => splitCsvLine(ln, delim));
    const autoParsed = trimParsed(parseBankStatementCsv(text));
    if (!autoParsed.length) warnings.push("No transactions parsed — try column mapping or check the export format.");
    base.suggestedBank = detectBankFormat(text.slice(0, 8000));
    return {
      ...base,
      rawTextPreview: text.slice(0, 4000),
      tablePreview: previewRows.slice(0, 10),
      tableSample,
      sheetNames: null,
      csvFullText: text.length <= 2_000_000 ? text : null,
      autoParsed,
    };
  }

  if (kind === "xlsx" || kind === "xls") {
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const names = wb.SheetNames;
    base.sheetNames = names;
    if (!names.length) {
      warnings.push("Workbook has no sheets.");
      return { ...base, autoParsed: [], csvFullText: null };
    }
    const si = Math.min(Math.max(0, opts?.sheetIndex ?? 0), names.length - 1);
    const first = names[si]!;
    const sheet = wb.Sheets[first]!;
    const matrix = sheetToMatrix(sheet, MAX_TABLE_ROWS);
    const headerIdx = suggestHeaderRow(matrix);
    const joined = matrix.slice(0, 15).flat().join("\n");
    base.suggestedBank = detectBankFormat(joined);
    return {
      ...base,
      tablePreview: matrix.slice(0, 10),
      tableSample: matrix,
      rawTextPreview: null,
      autoParsed: [],
      csvFullText: null,
      warnings:
        matrix.length >= MAX_TABLE_ROWS
          ? [...warnings, `Only the first ${MAX_TABLE_ROWS} rows were loaded — split very large sheets if needed.`]
          : warnings,
    };
  }

  const mime =
    kind === "pdf"
      ? "application/pdf"
      : mimeType.startsWith("image/")
        ? mimeType
        : `image/${ext === "jpg" ? "jpeg" : ext}`;

  const raw = await extractRawTextFromDocument(buffer, mime);
  base.ocrConfidence = raw.confidence;
  base.ocrEngine = raw.engine;
  const text = raw.text;
  base.suggestedBank = detectBankFormat(text.slice(0, 12000));

  if (raw.confidence < 0.35) {
    warnings.push("OCR confidence is low — review every row before import.");
  }
  if (kind === "pdf" && text.length < 80) {
    warnings.push(
      "Very little text in this PDF (likely scanned). Export CSV from your bank or upload clear images of each page.",
    );
  }

  const plain = parseTransactionsFromPlainText(text, base.suggestedBank);
  warnings.push(...plain.warnings);
  let autoParsed = trimParsed(plain.rows);
  if (!autoParsed.length && text.length > 200) {
    const fallback = parseBankStatementCsv(text);
    if (fallback.length) {
      autoParsed = trimParsed(fallback);
      warnings.push("Used CSV-style parsing on extracted PDF text.");
    }
  }
  warnings.push(...validateRunningBalances(autoParsed, null));
  if (!autoParsed.length) warnings.push("Could not detect transaction rows — edit manually or try another format.");

  return {
    ...base,
    rawTextPreview: text.slice(0, 8000),
    tablePreview: null,
    tableSample: null,
    csvFullText: null,
    autoParsed,
    warnings,
  };
}

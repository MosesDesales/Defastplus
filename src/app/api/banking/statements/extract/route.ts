import { NextResponse } from "next/server";
import { extractBankStatementFromBuffer } from "@/lib/banking/extract-from-file";
import type { ParsedBankRow } from "@/lib/banking/parse-csv";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;

function serializeParsed(rows: ParsedBankRow[]) {
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

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 10MB limit." }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";
  const sheetIndexRaw = form.get("sheetIndex");
  const sheetIndex =
    typeof sheetIndexRaw === "string" && sheetIndexRaw.trim() ? parseInt(sheetIndexRaw, 10) : 0;

  try {
    const out = await extractBankStatementFromBuffer(buf, file.name, mime, {
      sheetIndex: Number.isFinite(sheetIndex) ? sheetIndex : 0,
    });
    return NextResponse.json({
      kind: out.kind,
      mime: out.mime,
      fileName: out.fileName,
      fileSizeBytes: out.fileSizeBytes,
      suggestedBank: out.suggestedBank,
      warnings: out.warnings,
      ocrConfidence: out.ocrConfidence,
      ocrEngine: out.ocrEngine,
      rawTextPreview: out.rawTextPreview,
      tablePreview: out.tablePreview,
      tableSample: out.tableSample,
      sheetNames: out.sheetNames,
      autoParsed: serializeParsed(out.autoParsed),
      csvFullText: out.csvFullText,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Extract failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-auth";
import { isValidGstin, normalizeGstin } from "@/lib/gstin";

/** Placeholder: real taxpayer lookup requires GST portal / GSP integration. */
export async function POST(request: Request) {
  const session = await requireApiPermission("settings.view");
  if (session instanceof NextResponse) return session;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const gstin = normalizeGstin(String((json as { gstin?: string }).gstin ?? ""));
  if (!gstin) return NextResponse.json({ error: "Enter a GSTIN" }, { status: 400 });
  if (!isValidGstin(gstin)) return NextResponse.json({ error: "GSTIN format is invalid" }, { status: 400 });

  return NextResponse.json({
    ok: true,
    gstin,
    legalName: null as string | null,
    tradeName: null as string | null,
    message:
      "GSTIN format is valid. Automatic taxpayer lookup is not connected in this build — enter legal and trade names manually or connect your GST portal integration later.",
  });
}

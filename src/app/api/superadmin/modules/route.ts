import { NextResponse } from "next/server";
import { requireSuperUserApi } from "@/lib/superadmin/guard";
import { BUNDLED_CAPABILITIES, MODULES, UNAVAILABLE_MODULES } from "@/lib/superadmin/modules";

export async function GET() {
  const session = await requireSuperUserApi();
  if (session instanceof NextResponse) return session;
  return NextResponse.json({
    modules: MODULES.map(({ key, label, category, description, required }) => ({
      key,
      label,
      category,
      description,
      required: Boolean(required),
    })),
    unavailable: UNAVAILABLE_MODULES,
    bundled: BUNDLED_CAPABILITIES,
  });
}

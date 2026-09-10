import { NextResponse } from "next/server";
import { ensureInventorySettings } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { inventorySettingsSchema } from "@/lib/validators";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const s = await ensureInventorySettings(prisma, session.sub);
  return NextResponse.json({
    valuationMethod: s.valuationMethod,
  });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = inventorySettingsSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  await ensureInventorySettings(prisma, session.sub);
  const s = await prisma.inventorySettings.update({
    where: { userId: session.sub },
    data: { valuationMethod: parsed.data.valuationMethod },
  });

  return NextResponse.json({ valuationMethod: s.valuationMethod });
}

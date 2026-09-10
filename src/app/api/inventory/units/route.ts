import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { inventoryUnitSchema } from "@/lib/validators";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const units = await prisma.inventoryUnit.findMany({
    where: { userId: session.sub },
    orderBy: { name: "asc" },
    include: { _count: { select: { items: true } } },
  });

  return NextResponse.json({
    units: units.map((u) => ({
      id: u.id,
      name: u.name,
      abbreviation: u.abbreviation,
      itemCount: u._count.items,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = inventoryUnitSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const u = await prisma.inventoryUnit.create({
      data: {
        userId: session.sub,
        name: parsed.data.name,
        abbreviation: parsed.data.abbreviation?.trim() ?? "",
      },
    });
    return NextResponse.json(
      { unit: { id: u.id, name: u.name, abbreviation: u.abbreviation } },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Unit name already exists" }, { status: 409 });
  }
}

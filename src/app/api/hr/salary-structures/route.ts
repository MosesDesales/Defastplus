import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { normalizeComponents } from "@/lib/hr/salary-component-input";

/** Company-wide reusable salary templates (isTemplate: true). Per-employee custom salaries live under /api/hr/employees/[id]/salary. */
export async function GET() {
  const session = await requireApiPermission("payroll.view");
  if (session instanceof NextResponse) return session;

  const rows = await prisma.salaryStructure.findMany({
    where: { userId: session.sub, isTemplate: true },
    include: { components: { orderBy: { sortOrder: "asc" } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    structures: rows.map((s) => ({
      id: s.id,
      name: s.name,
      components: s.components.map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
        amountType: c.amountType,
        amount: Number(c.amount),
        percentOfBasic: c.percentOfBasic != null ? Number(c.percentOfBasic) : null,
        sortOrder: c.sortOrder,
      })),
    })),
  });
}

export async function POST(request: Request) {
  const session = await requireApiPermission("payroll.edit");
  if (session instanceof NextResponse) return session;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const d = json as { name?: string; components?: unknown };
  const name = d.name?.trim();
  if (!name) return NextResponse.json({ error: "Structure name required" }, { status: 400 });

  const norm = normalizeComponents(d.components);
  if (!norm.ok) return NextResponse.json({ error: norm.error }, { status: 400 });

  const structure = await prisma.salaryStructure.create({
    data: {
      userId: session.sub,
      name,
      isTemplate: true,
      components: { create: norm.data },
    },
  });

  return NextResponse.json({ structure: { id: structure.id } }, { status: 201 });
}

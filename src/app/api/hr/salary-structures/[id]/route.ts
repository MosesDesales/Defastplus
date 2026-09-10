import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { normalizeComponents } from "@/lib/hr/salary-component-input";

type P = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, props: P) {
  const session = await requireApiPermission("payroll.edit");
  if (session instanceof NextResponse) return session;
  const { id } = await props.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await prisma.salaryStructure.findFirst({ where: { id, userId: session.sub, isTemplate: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const d = json as { name?: string; components?: unknown };
  const name = d.name?.trim();
  if (!name) return NextResponse.json({ error: "Structure name required" }, { status: 400 });

  const norm = normalizeComponents(d.components);
  if (!norm.ok) return NextResponse.json({ error: norm.error }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    await tx.salaryStructure.update({ where: { id }, data: { name } });
    await tx.salaryComponent.deleteMany({ where: { structureId: id } });
    await tx.salaryComponent.createMany({ data: norm.data.map((c) => ({ ...c, structureId: id })) });
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, props: P) {
  const session = await requireApiPermission("payroll.edit");
  if (session instanceof NextResponse) return session;
  const { id } = await props.params;

  const existing = await prisma.salaryStructure.findFirst({
    where: { id, userId: session.sub, isTemplate: true },
    include: { _count: { select: { employees: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing._count.employees > 0) {
    return NextResponse.json({ error: `In use by ${existing._count.employees} employee(s)` }, { status: 409 });
  }

  await prisma.salaryStructure.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

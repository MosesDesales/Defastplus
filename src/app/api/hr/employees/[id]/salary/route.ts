import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { normalizeComponents } from "@/lib/hr/salary-component-input";
import { writeAuditLog } from "@/lib/audit";

type P = { params: Promise<{ id: string }> };

/** Assign an employee either a company template or their own custom salary breakdown. */
export async function PUT(request: Request, props: P) {
  const session = await requireApiPermission("payroll.edit");
  if (session instanceof NextResponse) return session;
  const { id: employeeId } = await props.params;

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, userId: session.sub },
    include: { salaryStructure: true },
  });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const d = json as { mode?: "template" | "custom"; salaryStructureId?: string; components?: unknown };
  const priorCustomId =
    employee.salaryStructure && !employee.salaryStructure.isTemplate ? employee.salaryStructure.id : null;

  if (d.mode === "template") {
    const structureId = d.salaryStructureId?.trim();
    if (!structureId) return NextResponse.json({ error: "salaryStructureId required" }, { status: 400 });
    const template = await prisma.salaryStructure.findFirst({
      where: { id: structureId, userId: session.sub, isTemplate: true },
    });
    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.employee.update({ where: { id: employeeId }, data: { salaryStructureId: structureId } });
      if (priorCustomId) await tx.salaryStructure.delete({ where: { id: priorCustomId } });
    });

    await writeAuditLog(session.sub, "UPDATE", "Employee", employeeId, { salaryMode: "template", structureId });
    return NextResponse.json({ ok: true });
  }

  if (d.mode === "custom") {
    const norm = normalizeComponents(d.components);
    if (!norm.ok) return NextResponse.json({ error: norm.error }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      if (priorCustomId) {
        await tx.salaryComponent.deleteMany({ where: { structureId: priorCustomId } });
        await tx.salaryComponent.createMany({ data: norm.data.map((c) => ({ ...c, structureId: priorCustomId })) });
      } else {
        const created = await tx.salaryStructure.create({
          data: {
            userId: session.sub,
            name: `${employee.displayName} — Custom`,
            isTemplate: false,
            components: { create: norm.data },
          },
        });
        await tx.employee.update({ where: { id: employeeId }, data: { salaryStructureId: created.id } });
      }
    });

    await writeAuditLog(session.sub, "UPDATE", "Employee", employeeId, { salaryMode: "custom" });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "mode must be 'template' or 'custom'" }, { status: 400 });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";

type P = { params: Promise<{ id: string }> };

export async function GET(_request: Request, props: P) {
  const session = await requireApiPermission("hr.view");
  if (session instanceof NextResponse) return session;
  const { id } = await props.params;

  const e = await prisma.employee.findFirst({
    where: { id, userId: session.sub },
    include: {
      salaryStructure: { include: { components: { orderBy: { sortOrder: "asc" } } } },
      payslips: { take: 12, orderBy: { id: "desc" }, include: { payrollRun: { select: { yearMonth: true, status: true } } } },
    },
  });

  if (!e) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    employee: {
      id: e.id,
      employeeNumber: e.employeeNumber,
      displayName: e.displayName,
      email: e.email,
      phone: e.phone,
      department: e.department,
      designation: e.designation,
      dateOfJoining: e.dateOfJoining?.toISOString().slice(0, 10) ?? null,
      salaryStructureId: e.salaryStructureId,
      salaryStructure: e.salaryStructure
        ? {
            id: e.salaryStructure.id,
            name: e.salaryStructure.name,
            isTemplate: e.salaryStructure.isTemplate,
            components: e.salaryStructure.components.map((c) => ({
              id: c.id,
              name: c.name,
              kind: c.kind,
              amountType: c.amountType,
              amount: Number(c.amount),
              percentOfBasic: c.percentOfBasic != null ? Number(c.percentOfBasic) : null,
            })),
          }
        : null,
      bankAccountName: e.bankAccountName,
      bankIfsc: e.bankIfsc,
      bankAccountNo: e.bankAccountNo,
      pan: e.pan,
      aadhaarLast4: e.aadhaarLast4,
      isActive: e.isActive,
      payslipHistory: e.payslips.map((p) => ({
        id: p.id,
        yearMonth: p.payrollRun.yearMonth,
        status: p.payrollRun.status,
        gross: Number(p.gross),
        netPay: Number(p.netPay),
      })),
    },
  });
}

export async function PATCH(request: Request, props: P) {
  const session = await requireApiPermission("hr.edit");
  if (session instanceof NextResponse) return session;
  const { id } = await props.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const d = json as Record<string, unknown>;

  const existing = await prisma.employee.findFirst({
    where: { id, userId: session.sub },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.employee.update({
    where: { id },
    data: {
      ...(d.displayName !== undefined ? { displayName: String(d.displayName).trim() } : {}),
      ...(d.email !== undefined ? { email: d.email ? String(d.email).trim() : null } : {}),
      ...(d.phone !== undefined ? { phone: d.phone ? String(d.phone).trim() : null } : {}),
      ...(d.department !== undefined ? { department: d.department ? String(d.department) : null } : {}),
      ...(d.designation !== undefined ? { designation: d.designation ? String(d.designation) : null } : {}),
      ...(d.dateOfJoining !== undefined ? { dateOfJoining: d.dateOfJoining ? new Date(String(d.dateOfJoining)) : null } : {}),
      ...(d.salaryStructureId !== undefined ? { salaryStructureId: d.salaryStructureId ? String(d.salaryStructureId) : null } : {}),
      ...(d.bankAccountName !== undefined ? { bankAccountName: d.bankAccountName ? String(d.bankAccountName) : null } : {}),
      ...(d.bankIfsc !== undefined ? { bankIfsc: d.bankIfsc ? String(d.bankIfsc) : null } : {}),
      ...(d.bankAccountNo !== undefined ? { bankAccountNo: d.bankAccountNo ? String(d.bankAccountNo) : null } : {}),
      ...(d.pan !== undefined ? { pan: d.pan ? String(d.pan) : null } : {}),
      ...(d.aadhaarLast4 !== undefined ? { aadhaarLast4: d.aadhaarLast4 ? String(d.aadhaarLast4).slice(0, 4) : null } : {}),
      ...(d.isActive !== undefined ? { isActive: Boolean(d.isActive) } : {}),
    },
  });

  await writeAuditLog(session.sub, "UPDATE", "Employee", id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, props: P) {
  const session = await requireApiPermission("hr.edit");
  if (session instanceof NextResponse) return session;
  const { id } = await props.params;

  const existing = await prisma.employee.findFirst({
    where: { id, userId: session.sub },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.employee.delete({ where: { id } });
  await writeAuditLog(session.sub, "DELETE", "Employee", id);

  return NextResponse.json({ ok: true });
}

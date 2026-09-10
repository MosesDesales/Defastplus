import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  const session = await requireApiPermission("hr.view");
  if (session instanceof NextResponse) return session;

  const rows = await prisma.employee.findMany({
    where: { userId: session.sub },
    include: { salaryStructure: { select: { id: true, name: true } } },
    orderBy: { employeeNumber: "asc" },
  });

  return NextResponse.json({
    employees: rows.map((e) => ({
      id: e.id,
      employeeNumber: e.employeeNumber,
      displayName: e.displayName,
      email: e.email,
      phone: e.phone,
      department: e.department,
      designation: e.designation,
      dateOfJoining: e.dateOfJoining?.toISOString().slice(0, 10) ?? null,
      salaryStructureId: e.salaryStructureId,
      salaryStructureName: e.salaryStructure?.name ?? null,
      pan: e.pan,
      isActive: e.isActive,
    })),
  });
}

export async function POST(request: Request) {
  const session = await requireApiPermission("hr.edit");
  if (session instanceof NextResponse) return session;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const d = json as Record<string, unknown>;
  const displayName = String(d.displayName ?? "").trim();
  if (!displayName) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const n = await prisma.employee.count({ where: { userId: session.sub } });
  const employeeNumber = `EMP-${String(n + 1).padStart(5, "0")}`;

  const row = await prisma.employee.create({
    data: {
      userId: session.sub,
      employeeNumber,
      displayName,
      email: d.email ? String(d.email).trim() : null,
      phone: d.phone ? String(d.phone).trim() : null,
      department: d.department ? String(d.department).trim() : null,
      designation: d.designation ? String(d.designation).trim() : null,
      dateOfJoining: d.dateOfJoining ? new Date(String(d.dateOfJoining)) : null,
      salaryStructureId: d.salaryStructureId ? String(d.salaryStructureId) : null,
      bankAccountName: d.bankAccountName ? String(d.bankAccountName) : null,
      bankIfsc: d.bankIfsc ? String(d.bankIfsc) : null,
      bankAccountNo: d.bankAccountNo ? String(d.bankAccountNo) : null,
      pan: d.pan ? String(d.pan) : null,
      aadhaarLast4: d.aadhaarLast4 ? String(d.aadhaarLast4).slice(0, 4) : null,
      isActive: d.isActive !== false,
    },
  });

  await writeAuditLog(session.sub, "CREATE", "Employee", row.id);

  return NextResponse.json({ employee: { id: row.id, employeeNumber: row.employeeNumber } }, { status: 201 });
}

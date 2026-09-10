import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiModules } from "@/lib/api-require-module";
import { getSession } from "@/lib/session";
import { timeProjectCreateSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "time_tracking");
  if (denied) return denied;

  const projects = await prisma.timeProject.findMany({
    where: { userId: session.sub },
    orderBy: { updatedAt: "desc" },
    include: {
      customer: { select: { id: true, displayName: true } },
      members: { include: { employee: { select: { id: true, displayName: true } } } },
      _count: { select: { tasks: true, entries: true } },
    },
  });
  return NextResponse.json({
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      customerId: p.customerId,
      customerName: p.customer.displayName,
      hourlyRate: Number(p.hourlyRate),
      billingType: p.billingType,
      budgetHours: p.budgetHours != null ? Number(p.budgetHours) : null,
      status: p.status,
      progressPercent: p.progressPercent,
      startDate: p.startDate?.toISOString() ?? null,
      endDate: p.endDate?.toISOString() ?? null,
      description: p.description,
      memberCount: p.members.length,
      taskCount: p._count.tasks,
      entryCount: p._count.entries,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "time_tracking");
  if (denied) return denied;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = timeProjectCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const cust = await prisma.customer.findFirst({ where: { id: d.customerId, userId: session.sub } });
  if (!cust) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const startDate = d.startDate?.trim() ? new Date(d.startDate) : null;
  const endDate = d.endDate?.trim() ? new Date(d.endDate) : null;

  try {
    const p = await prisma.$transaction(async (tx) => {
      const proj = await tx.timeProject.create({
        data: {
          userId: session.sub,
          customerId: d.customerId,
          name: d.name.trim(),
          description: d.description?.trim() || null,
          startDate: startDate && !Number.isNaN(startDate.getTime()) ? startDate : null,
          endDate: endDate && !Number.isNaN(endDate.getTime()) ? endDate : null,
          hourlyRate: new Prisma.Decimal(d.hourlyRate ?? 0),
          billingType: d.billingType ?? "PROJECT_HOURS",
          budgetHours: d.budgetHours != null ? new Prisma.Decimal(d.budgetHours) : null,
          status: d.status ?? "ACTIVE",
          progressPercent: d.progressPercent ?? 0,
        },
      });
      const ids = d.memberEmployeeIds ?? [];
      for (const eid of ids) {
        const emp = await tx.employee.findFirst({ where: { id: eid, userId: session.sub } });
        if (emp) {
          await tx.timeProjectMember.create({
            data: { projectId: proj.id, employeeId: eid },
          });
        }
      }
      return proj;
    });
    return NextResponse.json({ id: p.id }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not create project" }, { status: 500 });
  }
}

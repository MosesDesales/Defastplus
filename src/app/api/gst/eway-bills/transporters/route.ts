import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

/** GET /api/gst/eway-bills/transporters */
export async function GET() {
  const session = await requireApiPermission("gst.view");
  if (session instanceof NextResponse) return session;

  const items = await prisma.transporter.findMany({
    where: { userId: session.sub, isActive: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ items });
}

const postSchema = z.object({
  name: z.string().min(1).max(200),
  gstin: z.string().max(15).optional(),
  transporterId: z.string().max(50).optional(),
});

/** POST /api/gst/eway-bills/transporters */
export async function POST(request: Request) {
  const session = await requireApiPermission("gst.edit");
  if (session instanceof NextResponse) return session;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const item = await prisma.transporter.create({
    data: { userId: session.sub, ...parsed.data },
  });
  return NextResponse.json(item, { status: 201 });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, name: true, permissions: true, createdAt: true },
  });

  if (!user) return NextResponse.json({ user: null });

  let permissions: string[] = session.permissions;
  try {
    const fromDb = JSON.parse(user.permissions) as unknown;
    if (Array.isArray(fromDb) && fromDb.every((x) => typeof x === "string")) {
      permissions = fromDb as string[];
    }
  } catch {
    /* use session */
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      permissions,
    },
  });
}

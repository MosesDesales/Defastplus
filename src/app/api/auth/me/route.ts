import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUserAccessState } from "@/lib/superadmin/access";

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

  const access = await getUserAccessState(user.id);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      permissions,
      isSuperUser: access?.isSuperUser ?? false,
      modules: access ? [...access.modules] : [],
    },
  });
}

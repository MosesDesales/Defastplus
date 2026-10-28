import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signSession, SESSION_COOKIE } from "@/lib/auth";
import { parsePermissionsJson } from "@/lib/permissions";
import { loginSchema } from "@/lib/validators";

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { email: emailAddr, password } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { email: emailAddr.toLowerCase() },
  });

  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  // Checked only after the password matches so the response does not reveal account state.
  if (!user.isActive) {
    return NextResponse.json(
      { error: "This account has been deactivated. Contact your administrator." },
      { status: 403 },
    );
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const permissions = parsePermissionsJson(user.permissions);

  const token = await signSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    permissions,
    sessionVersion: user.sessionVersion,
  });

  const res = NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
    redirectTo: user.isSuperUser ? "/superadmin" : "/dashboard",
  });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

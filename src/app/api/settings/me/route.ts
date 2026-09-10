import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signSession, SESSION_COOKIE } from "@/lib/auth";
import { requireApiSession } from "@/lib/api-auth";
import { parsePermissionsJson } from "@/lib/permissions";

/** PATCH — update profile name or password (re-issues session). */
export async function PATCH(request: Request) {
  const session = await requireApiSession();
  if (session instanceof NextResponse) return session;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const d = json as { name?: string; currentPassword?: string; newPassword?: string };

  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (d.newPassword) {
    const cur = d.currentPassword ?? "";
    const ok = await bcrypt.compare(cur, user.passwordHash);
    if (!ok) return NextResponse.json({ error: "Current password incorrect" }, { status: 400 });
    if (d.newPassword.length < 8) return NextResponse.json({ error: "Password too short" }, { status: 400 });
    const passwordHash = await bcrypt.hash(d.newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, ...(d.name ? { name: d.name.trim() } : {}) },
    });
  } else if (d.name?.trim()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { name: d.name.trim() },
    });
  } else {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await prisma.user.findUnique({ where: { id: user.id } });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const permissions = parsePermissionsJson(updated.permissions);
  const token = await signSession({
    sub: updated.id,
    email: updated.email,
    name: updated.name,
    permissions,
  });

  const res = NextResponse.json({ ok: true, user: { name: updated.name, email: updated.email } });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

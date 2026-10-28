import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import type { SessionPayload } from "@/lib/auth";
import { SuperAdminError } from "@/lib/superadmin/service";

/**
 * Authoritative Super User check for route handlers and pages. The proxy also blocks
 * non-Super Users, but this re-reads the role from the database on every call.
 */
export async function getSuperUserSession(): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session) return null;
  const u = await prisma.user.findUnique({ where: { id: session.sub }, select: { isSuperUser: true, isActive: true } });
  return u?.isSuperUser && u.isActive ? session : null;
}

export async function requireSuperUserApi(): Promise<SessionPayload | NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const su = await getSuperUserSession();
  if (!su) return NextResponse.json({ error: "Super User access required" }, { status: 403 });
  return su;
}

/** Uniform error responses for Super User APIs. */
export function superAdminErrorResponse(e: unknown): NextResponse {
  if (e instanceof SuperAdminError) {
    return NextResponse.json({ error: e.message, ...(e.details ? { details: e.details } : {}) }, { status: e.status });
  }
  if (e instanceof ZodError) {
    return NextResponse.json({ error: "Validation failed", issues: e.flatten() }, { status: 400 });
  }
  console.error("[superadmin]", e);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new SuperAdminError(400, "Invalid JSON body");
  }
}

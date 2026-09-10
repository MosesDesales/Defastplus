import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import type { SessionPayload } from "@/lib/auth";

export async function requireApiSession(): Promise<SessionPayload | NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return session;
}

export async function requireApiPermission(permission: string): Promise<SessionPayload | NextResponse> {
  const s = await requireApiSession();
  if (s instanceof NextResponse) return s;
  if (!hasPermission(s.permissions, permission)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  return s;
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { hasPermission, permissionForPath } from "@/lib/permissions";

const SESSION_COOKIE = "dab_session";

function permissionsFromPayload(payload: Record<string, unknown>): string[] {
  const raw = payload.permissions;
  if (Array.isArray(raw) && raw.every((x) => typeof x === "string")) return raw as string[];
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown;
      if (Array.isArray(p) && p.every((x) => typeof x === "string")) return p as string[];
    } catch {
      /* ignore */
    }
  }
  return ["*"];
}

export async function middleware(request: NextRequest) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    console.error("AUTH_SECRET is missing or too short");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const path = request.nextUrl.pathname;
    const required = permissionForPath(path);
    if (required) {
      const perms = permissionsFromPayload(payload as Record<string, unknown>);
      if (!hasPermission(perms, required)) {
        return NextResponse.redirect(new URL("/dashboard?access=denied", request.url));
      }
    }
    return NextResponse.next();
  } catch {
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*", "/integrations/:path*", "/time-tracking/:path*"],
};

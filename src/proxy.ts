import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { hasPermission, permissionForPath } from "@/lib/permissions";
import { getUserAccessState, isSessionCurrent } from "@/lib/superadmin/access";
import { isPathAllowedForModules } from "@/lib/superadmin/modules";

/** Handled entirely by their own routes: sign-in must work with a stale cookie; cron uses CRON_SECRET. */
const PASS_THROUGH_API = ["/api/auth/", "/api/cron/"];

function isSuperUserPath(path: string) {
  return path === "/superadmin" || path.startsWith("/superadmin/") || path.startsWith("/api/superadmin/");
}

function signedOut(request: NextRequest, isApi: boolean) {
  const res = isApi
    ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    : NextResponse.redirect(new URL("/login", request.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

function denied(request: NextRequest, isApi: boolean, error: string, redirectTo: string) {
  return isApi
    ? NextResponse.json({ error }, { status: 403 })
    : NextResponse.redirect(new URL(redirectTo, request.url));
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isApi = path.startsWith("/api/");
  if (isApi && PASS_THROUGH_API.some((p) => path.startsWith(p))) return NextResponse.next();

  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    console.error("AUTH_SECRET is missing or too short");
    return isApi
      ? NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
      : NextResponse.redirect(new URL("/login", request.url));
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    // API routes answer 401 themselves; pages go to sign-in.
    return isApi ? NextResponse.next() : NextResponse.redirect(new URL("/login", request.url));
  }

  let session;
  try {
    session = await verifySession(token);
  } catch {
    return signedOut(request, isApi);
  }

  const state = await getUserAccessState(session.sub);
  if (!isSessionCurrent(state, session.sessionVersion)) return signedOut(request, isApi);

  if (isSuperUserPath(path)) {
    if (!state.isSuperUser) return denied(request, isApi, "Super User access required", "/dashboard?access=denied");
    return NextResponse.next();
  }

  if (!isApi) {
    const required = permissionForPath(path);
    if (required && !hasPermission(session.permissions, required)) {
      return NextResponse.redirect(new URL("/dashboard?access=denied", request.url));
    }
  }

  if (!isPathAllowedForModules(path, state.modules, request.method)) {
    return denied(
      request,
      isApi,
      "This module is not assigned to your account.",
      "/dashboard?module=unassigned",
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/settings/:path*",
    "/integrations/:path*",
    "/time-tracking/:path*",
    "/tasks/:path*",
    "/banking/:path*",
    "/superadmin/:path*",
    "/api/:path*",
  ],
};

import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "dab_session";

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET must be set and at least 16 characters");
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  permissions: string[];
  /** Must equal `User.sessionVersion`; bumping that column revokes the token. */
  sessionVersion: number;
};

export async function signSession(payload: SessionPayload) {
  return new SignJWT({
    email: payload.email,
    name: payload.name,
    permissions: payload.permissions,
    sv: payload.sessionVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());
}

export async function verifySession(token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, getSecretKey());
  const sub = payload.sub;
  const email = typeof payload.email === "string" ? payload.email : "";
  const name = typeof payload.name === "string" ? payload.name : "";
  if (!sub || !email) {
    throw new Error("Invalid session");
  }
  let permissions: string[] = ["*"];
  const raw = payload.permissions;
  if (Array.isArray(raw) && raw.every((x) => typeof x === "string")) {
    permissions = raw as string[];
  } else if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown;
      if (Array.isArray(p) && p.every((x) => typeof x === "string")) permissions = p as string[];
    } catch {
      /* keep default */
    }
  }
  return { sub, email, name, permissions, sessionVersion: sessionVersionFromPayload(payload) };
}

/** Tokens issued before session versioning carry no `sv` claim and count as version 0. */
export function sessionVersionFromPayload(payload: Record<string, unknown>): number {
  return typeof payload.sv === "number" && Number.isInteger(payload.sv) ? payload.sv : 0;
}

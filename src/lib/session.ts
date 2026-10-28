import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import type { SessionPayload } from "@/lib/auth";
import { getSessionAccessState } from "@/lib/superadmin/access";

/**
 * Verified session, or null. Besides the JWT signature this checks the database, so
 * deactivated users and revoked tokens (sessionVersion bumped) are rejected everywhere.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  let session: SessionPayload;
  try {
    session = await verifySession(token);
  } catch {
    return null;
  }
  return (await getSessionAccessState(session.sub, session.sessionVersion)) ? session : null;
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardHeaderClient } from "@/components/DashboardHeaderClient";
import { DashboardChrome } from "@/components/DashboardChrome";
import { SESSION_COOKIE } from "@/lib/auth";
import { getSession } from "@/lib/session";

async function logout() {
  "use server";
  (await cookies()).set(SESSION_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  redirect("/login");
}

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {session ? (
        <DashboardHeaderClient user={{ email: session.email, name: session.name }}>
          <form action={logout} className="block w-full">
            <button
              type="submit"
              className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              Sign out
            </button>
          </form>
        </DashboardHeaderClient>
      ) : null}

      <DashboardChrome>{children}</DashboardChrome>
    </div>
  );
}

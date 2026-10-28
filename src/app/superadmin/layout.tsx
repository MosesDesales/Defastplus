import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { SESSION_COOKIE } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { getSuperUserSession } from "@/lib/superadmin/guard";

async function logout() {
  "use server";
  (await cookies()).set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  redirect("/login");
}

export default async function SuperAdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!(await getSession())) redirect("/login");
  const session = await getSuperUserSession();
  if (!session) redirect("/dashboard?access=denied");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo href="/superadmin" />
            <span className="hidden items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800 ring-1 ring-teal-200 dark:bg-teal-950/50 dark:text-teal-200 dark:ring-teal-900 sm:inline-flex">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Super User
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="hidden max-w-[16rem] truncate text-sm text-slate-600 dark:text-slate-400 md:inline" title={session.email}>
              {session.email}
            </span>
            <Link
              href="/dashboard"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 sm:inline-block"
            >
              Accounting app
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      {/* Bottom padding keeps the last rows clear of the floating assistant button. */}
      <main className="mx-auto max-w-[1600px] px-4 pb-28 pt-6 sm:px-6">{children}</main>
    </div>
  );
}

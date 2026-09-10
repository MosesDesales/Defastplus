import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 shadow-sm backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/80">
      <div className="mx-auto flex min-h-[5.5rem] max-w-6xl items-center justify-between px-4 sm:min-h-[6rem] sm:px-6">
        <BrandLogo size="md" priority />
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900/90 dark:text-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-800"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-gradient-to-r from-[#0f766e] to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-teal-900/20 ring-1 ring-white/10 transition hover:from-[#0d9488] hover:to-teal-500 dark:hover:to-teal-500"
          >
            Sign up
          </Link>
        </nav>
      </div>
    </header>
  );
}

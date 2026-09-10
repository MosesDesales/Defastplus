"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { Settings2 } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { DashboardSettingsMenu } from "@/components/DashboardSettingsMenu";

function cx(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function DashboardHeaderClient({
  user,
  children,
}: Readonly<{
  user: { email: string; name: string };
  /** Server-rendered sign-out form passed from layout */
  children?: React.ReactNode;
}>) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const initials = user.name
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="fixed left-0 right-0 top-0 z-40 h-16 border-b border-slate-200 bg-white sm:h-[4.5rem] dark:border-slate-800 dark:bg-slate-900">
      <div className="absolute left-0 top-0 flex h-16 w-56 items-center justify-center overflow-hidden border-r border-slate-200 bg-white sm:h-[4.5rem] dark:border-slate-800 dark:bg-slate-900">
        <BrandLogo href="/dashboard" size="header" priority />
      </div>

      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 pl-56 pr-4 sm:h-[4.5rem] sm:pr-6">
        <div className="hidden min-w-0 flex-1 md:block">
          <label htmlFor="global-search" className="sr-only">
            Search
          </label>
          <div className="relative mx-auto max-w-xl">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden>
              ⌕
            </span>
            <input
              id="global-search"
              type="search"
              placeholder="Search transactions, customers, items…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none ring-teal-600/15 focus:border-teal-600 focus:bg-white focus:ring-4 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500"
              disabled
              title="Global search coming soon"
            />
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <Suspense
            fallback={
              <div className="rounded-lg p-2 text-slate-300 dark:text-slate-600" aria-hidden title="Settings">
                <Settings2 className="h-5 w-5" strokeWidth={2} />
              </div>
            }
          >
            <DashboardSettingsMenu />
          </Suspense>

          <button
            type="button"
            className="relative rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Notifications"
            title="Notifications (coming soon)"
          >
            <span aria-hidden className="text-lg">
              🔔
            </span>
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-teal-500 ring-2 ring-white dark:ring-slate-900" />
          </button>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className={cx(
                "flex items-center gap-2 rounded-lg py-1.5 pl-1 pr-2 transition",
                menuOpen ? "bg-slate-100 dark:bg-slate-800" : "hover:bg-slate-100 dark:hover:bg-slate-800",
              )}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-800 dark:bg-teal-950 dark:text-teal-200">
                {initials}
              </span>
              <span className="hidden max-w-[140px] truncate text-left text-sm font-medium text-slate-800 dark:text-slate-100 lg:block">
                {user.name}
              </span>
              <span className="text-slate-400">▾</span>
            </button>

            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{user.name}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                </div>
                <Link
                  href="/dashboard"
                  role="menuitem"
                  className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  onClick={() => setMenuOpen(false)}
                >
                  Dashboard
                </Link>
                <div className="border-t border-slate-100 px-3 py-2 dark:border-slate-800">{children}</div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

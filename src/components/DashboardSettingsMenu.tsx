"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown, ChevronRight, Settings2 } from "lucide-react";
import {
  SETTINGS_MODULE_SECTION,
  SETTINGS_ORGANIZATION_SECTION,
  itemBasePath,
  itemHash,
  type SettingsMenuItem,
} from "@/lib/settings-nav";

function cx(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

function isOrganizationProfilePath(p: string) {
  return p === "/settings/profile" || p === "/dashboard/settings/profile";
}

function isRouteActive(pathname: string, search: string, hash: string, href: string): boolean {
  const base = itemBasePath(href);
  const profilePair = isOrganizationProfilePath(pathname) && isOrganizationProfilePath(base);
  if (!profilePair && pathname !== base) return false;

  const h = itemHash(href);
  if (profilePair) {
    if (h) return hash === h;
    return hash === "" && !href.includes("#");
  }
  if (h) return hash === h;

  if (href.includes("upcoming")) {
    const q = href.includes("?") ? href.split("?")[1]! : "";
    const exp = new URLSearchParams(q).get("k");
    if (exp != null) {
      const got = new URLSearchParams(search.replace(/^\?/, "")).get("k");
      return exp === got;
    }
  }

  return hash === "";
}

function groupHasActive(
  pathname: string,
  search: string,
  hash: string,
  items: readonly SettingsMenuItem[],
): boolean {
  return items.some((item) => {
    if (item.href.includes("/dashboard/settings/taxes")) {
      return pathname.startsWith("/dashboard/settings/taxes");
    }
    return isRouteActive(pathname, search, hash, item.href);
  });
}

function expandedIdsForRoute(pathname: string, search: string, hash: string): Set<string> {
  const next = new Set<string>();
  for (const g of SETTINGS_ORGANIZATION_SECTION.groups) {
    if (groupHasActive(pathname, search, hash, g.items)) next.add(g.id);
  }
  return next;
}

function subscribeLocationHash(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("hashchange", onStoreChange);
  return () => window.removeEventListener("hashchange", onStoreChange);
}

function getLocationHashSnapshot() {
  return typeof window !== "undefined" ? window.location.hash : "";
}

function getLocationHashServerSnapshot() {
  return "";
}

function moduleItemActive(pathname: string, item: SettingsMenuItem): boolean {
  const base = itemBasePath(item.href);
  if (item.href === "/dashboard/settings") return pathname === "/dashboard/settings" || pathname === "/dashboard/settings/";
  if (item.href === "/dashboard/inventory") return pathname === "/dashboard/inventory" || pathname.startsWith("/dashboard/inventory/");
  if (item.href === "/dashboard/banking") return pathname.startsWith("/dashboard/banking");
  if (item.href === "/dashboard/sales") return pathname.startsWith("/dashboard/sales");
  if (item.href === "/dashboard/purchases") return pathname.startsWith("/dashboard/purchases");
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function DashboardSettingsMenu() {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const search = useMemo(() => searchParams?.toString() ?? "", [searchParams]);
  const hash = useSyncExternalStore(subscribeLocationHash, getLocationHashSnapshot, getLocationHashServerSnapshot);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  function toggleGroup(id: string) {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const sectionTitle = "text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400";
  const groupHeader =
    "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium text-slate-800 transition hover:bg-violet-100/80 dark:text-slate-100 dark:hover:bg-violet-950/40";
  const groupHeaderOpen = "bg-violet-100/90 dark:bg-violet-950/35";
  const subLink =
    "block rounded-md px-3 py-2 pl-8 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800";
  const subLinkActive = "bg-sky-600 text-white hover:bg-sky-600 dark:bg-sky-600 dark:text-white dark:hover:bg-sky-600";

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (open) {
            setOpen(false);
            return;
          }
          setExpanded(expandedIdsForRoute(pathname, search, hash));
          setOpen(true);
        }}
        className={cx(
          "rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
          open && "bg-slate-100 dark:bg-slate-800",
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Settings menu"
        title="Settings"
      >
        <Settings2 className="h-5 w-5" strokeWidth={2} aria-hidden />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Settings"
          className="absolute right-0 top-full z-[60] mt-1 max-h-[min(80vh,640px)] w-[min(calc(100vw-1rem),420px)] overflow-y-auto rounded-xl border border-slate-200 bg-white py-3 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 pb-2">
            <p className="text-xs font-semibold text-slate-900 dark:text-white">Settings</p>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Organization and module shortcuts</p>
          </div>

          <div className="px-2">
            <p className={`${sectionTitle} px-2 pb-1 pt-2`}>{SETTINGS_ORGANIZATION_SECTION.title}</p>
            <div className="space-y-0.5">
              {SETTINGS_ORGANIZATION_SECTION.groups.map((group) => {
                const isOpen = expanded.has(group.id);
                return (
                  <div key={group.id} className="rounded-lg border border-transparent">
                    <button
                      type="button"
                      className={cx(groupHeader, isOpen && groupHeaderOpen)}
                      onClick={() => toggleGroup(group.id)}
                      aria-expanded={isOpen}
                    >
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                      )}
                      <span>{group.label}</span>
                    </button>
                    {isOpen ? (
                      <div className="pb-1 pt-0.5">
                        {group.items.map((item) => {
                          const active =
                            item.href.includes("/dashboard/settings/taxes") &&
                            pathname.startsWith("/dashboard/settings/taxes")
                              ? true
                              : isRouteActive(pathname, search, hash, item.href);
                          return (
                            <Link
                              key={item.href + item.label}
                              href={item.href}
                              className={cx(subLink, active && subLinkActive)}
                              onClick={() => setOpen(false)}
                            >
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 border-t border-slate-100 px-2 pt-2 dark:border-slate-800">
            <p className={`${sectionTitle} px-2 pb-2`}>{SETTINGS_MODULE_SECTION.title}</p>
            <ul className="space-y-0.5">
              {SETTINGS_MODULE_SECTION.items.map((item) => {
                const active = moduleItemActive(pathname, item);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cx(
                        "flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800",
                        active && "bg-sky-600 text-white hover:bg-sky-600 dark:bg-sky-600",
                      )}
                      onClick={() => setOpen(false)}
                    >
                      <ChevronRight className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-2 border-t border-slate-100 px-3 pt-2 dark:border-slate-800">
            <Link
              href="/dashboard/settings"
              className="text-xs font-medium text-teal-700 hover:underline dark:text-teal-400"
              onClick={() => setOpen(false)}
            >
              Open full settings workspace →
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

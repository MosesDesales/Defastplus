"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  Timer,
} from "lucide-react";

const LINKS = [
  { href: "/time-tracking", label: "Dashboard", icon: LayoutDashboard },
  { href: "/time-tracking/projects", label: "Projects", icon: FolderKanban },
  { href: "/time-tracking/tasks", label: "Tasks", icon: ListTodo },
  { href: "/time-tracking/timesheets", label: "Timesheets", icon: CalendarDays },
  { href: "/time-tracking/timer", label: "Timer", icon: Timer },
  { href: "/time-tracking/approvals", label: "Approvals", icon: CheckSquare },
  { href: "/time-tracking/reports", label: "Reports", icon: BarChart3 },
] as const;

function norm(p: string) {
  const x = (p || "/").replace(/\/$/, "") || "/";
  if (x === "/time-tracking" || x.startsWith("/time-tracking/")) {
    return "/dashboard/time-tracking" + (x === "/time-tracking" ? "" : x.slice("/time-tracking".length));
  }
  return p;
}

function active(pathname: string, href: string) {
  const pn = norm(pathname);
  const h = norm(href);
  return pn === h || pn.startsWith(`${h}/`);
}

export function TimeTrackingSubnav() {
  const pathname = usePathname() ?? "/";

  return (
    <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4 dark:border-slate-700">
      {LINKS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={
            active(pathname, href)
              ? "inline-flex items-center gap-2 rounded-full bg-teal-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm"
              : "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-teal-300 hover:text-teal-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-teal-700"
          }
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          {label}
        </Link>
      ))}
    </div>
  );
}

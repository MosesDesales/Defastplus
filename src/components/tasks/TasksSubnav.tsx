"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  Columns3,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  User,
} from "lucide-react";

const LINKS = [
  { href: "/tasks", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks/all", label: "All Tasks", icon: ListTodo },
  { href: "/tasks/my", label: "My Tasks", icon: User },
  { href: "/tasks/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks/board", label: "Kanban Board", icon: Columns3 },
  { href: "/tasks/calendar", label: "Calendar", icon: Calendar },
  { href: "/tasks/completed", label: "Completed", icon: CheckCircle2 },
] as const;

function norm(p: string) {
  const x = (p || "/").replace(/\/$/, "") || "/";
  if (x === "/tasks" || x.startsWith("/tasks/")) {
    return "/dashboard/tasks" + (x === "/tasks" ? "" : x.slice("/tasks".length));
  }
  return p;
}

function active(pathname: string, href: string) {
  const pn = norm(pathname);
  const h = norm(href);
  if (h === "/dashboard/tasks") return pn === h;
  return pn === h || pn.startsWith(`${h}/`);
}

export function TasksSubnav() {
  const pathname = usePathname() ?? "/";

  return (
    <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4 dark:border-slate-700">
      {LINKS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={
            active(pathname, href)
              ? "inline-flex items-center gap-2 rounded-full bg-violet-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm"
              : "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-violet-300 hover:text-violet-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
          }
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          {label}
        </Link>
      ))}
    </div>
  );
}

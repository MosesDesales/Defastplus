"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type RowAction = {
  label: string;
  icon?: LucideIcon;
  href?: string;
  onClick?: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

/** Per-row ⋮ menu — rendered in a portal so it is not clipped by table card `overflow-hidden`. */
export function TableRowActions({ actions }: Readonly<{ actions: RowAction[] }>) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  const updatePosition = useCallback(() => {
    const btn = wrapRef.current?.querySelector("button");
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onReposition = () => updatePosition();
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    function close(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("click", close);
      document.addEventListener("keydown", onKey);
      return () => {
        document.removeEventListener("click", close);
        document.removeEventListener("keydown", onKey);
      };
    }
  }, [open]);

  const menuClasses =
    "z-[100] min-w-[11rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900 dark:ring-white/10";

  const menu =
    open && mounted ? (
      <div
        ref={menuRef}
        role="menu"
        style={{ position: "fixed", top: pos.top, right: pos.right }}
        className={menuClasses}
      >
        {actions.map((a) => {
          const base =
            "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40";
          const danger = a.destructive ? " text-red-600 dark:text-red-400" : " text-slate-700 dark:text-slate-200";
          const Icon = a.icon;
          if (a.disabled) {
            return (
              <span key={a.label} className={base + danger + " cursor-not-allowed opacity-40"} role="menuitem">
                {Icon ? <Icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden /> : null}
                {a.label}
              </span>
            );
          }
          if (a.href) {
            return (
              <Link key={a.label} href={a.href} role="menuitem" className={base + danger} onClick={() => setOpen(false)}>
                {Icon ? <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden /> : null}
                {a.label}
              </Link>
            );
          }
          return (
            <button
              key={a.label}
              type="button"
              role="menuitem"
              className={base + danger}
              onClick={() => {
                setOpen(false);
                a.onClick?.();
              }}
            >
              {Icon ? <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden /> : null}
              {a.label}
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <div className="relative inline-block text-left" ref={wrapRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
        }}
        className="rounded-md px-2 py-1 text-lg leading-none text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Actions"
      >
        ⋮
      </button>
      {menu ? createPortal(menu, document.body) : null}
    </div>
  );
}

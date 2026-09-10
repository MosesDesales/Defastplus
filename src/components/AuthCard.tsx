import type { ReactNode } from "react";
import { BrandLogo } from "@/components/BrandLogo";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Hide built-in logo block (when shell already shows branding on mobile). */
  hideLogo?: boolean;
};

export function AuthCard({ title, subtitle, children, footer, hideLogo }: Props) {
  return (
    <div className="relative w-full max-w-md">
      <div
        className="absolute -inset-px rounded-[1.35rem] bg-gradient-to-br from-teal-400/50 via-teal-600/20 to-emerald-400/40 opacity-60 blur-[1px] dark:from-teal-500/30 dark:via-teal-600/15 dark:to-emerald-500/25 dark:opacity-100"
        aria-hidden
      />
      <div className="relative rounded-3xl border border-slate-200/90 bg-white/90 p-8 shadow-2xl shadow-slate-900/[0.06] ring-1 ring-white/60 backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-900/90 dark:shadow-black/40 dark:ring-white/5 sm:p-9">
        {!hideLogo ? (
          <div className="mb-8 hidden text-center lg:block">
            <BrandLogo size="lg" />
          </div>
        ) : null}
        <div className="text-center lg:text-left">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-[1.65rem]">{title}</h1>
          {subtitle ? <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{subtitle}</p> : null}
        </div>
        <div className="mt-8">{children}</div>
        {footer ? <div className="mt-8 border-t border-slate-100 pt-6 dark:border-slate-800/80">{footer}</div> : null}
      </div>
    </div>
  );
}
